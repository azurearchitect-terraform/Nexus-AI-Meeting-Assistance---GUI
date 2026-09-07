use std::collections::HashSet;
use std::net::IpAddr;
use std::time::Duration;
use reqwest::{header::LOCATION, redirect::Policy, Client, Url};
use regex::Regex;

const MAX_RESPONSE_BYTES: usize = 5 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
/// Per-page character budget. Applied before joining so a boilerplate-heavy home
/// page cannot consume the whole model context and truncate away the /about copy.
const MAX_CHARS_PER_PAGE: usize = 4000;
const MAX_SUBPAGES: usize = 3;
/// Below this, a page is navigation chrome rather than usable company content.
const MIN_MEANINGFUL_CHARS: usize = 600;

/// Ordered by research value. A page matching an earlier keyword is always
/// crawled before a later one, which keeps results reproducible across runs.
const PAGE_PRIORITIES: [&str; 6] = ["about", "culture", "career", "value", "mission", "team"];

/// How much usable company content the crawl actually recovered. The prompt layer
/// uses this to decide whether the model may describe the company at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScrapeQuality {
    /// Enough prose to ground a company profile.
    Rich,
    /// Something was returned, but it reads like nav chrome or a JS shell.
    Thin,
    /// Nothing usable was recovered.
    Failed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScrapeResult {
    pub text: String,
    pub quality: ScrapeQuality,
    pub pages_crawled: usize,
    pub host: String,
}

/// Words that appear on essentially every site's chrome. A page consisting mostly
/// of these is a navigation shell, not content, no matter how long it is.
const BOILERPLATE_MARKERS: [&str; 10] = [
    "cookie",
    "privacy policy",
    "terms of service",
    "all rights reserved",
    "sign in",
    "log in",
    "subscribe",
    "accept all",
    "skip to main content",
    "enable javascript",
];

/// Heuristic content check. Requires enough length AND enough sentence-like
/// structure, so a long list of menu links does not read as company prose.
fn looks_meaningful(text: &str) -> bool {
    if text.chars().count() < MIN_MEANINGFUL_CHARS {
        return false;
    }
    let lower = text.to_lowercase();
    let boilerplate_hits = BOILERPLATE_MARKERS
        .iter()
        .filter(|marker| lower.contains(*marker))
        .count();
    let sentences = text.matches(". ").count();
    let words = text.split_whitespace().count();

    // Real prose carries sentences; nav chrome is mostly short disconnected labels.
    sentences >= 5 && words >= 120 && boilerplate_hits < 6
}

fn truncate_chars(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let truncated: String = text.chars().take(limit).collect();
    format!("{truncated} [... page truncated ...]")
}

fn normalized_host(url: &Url) -> Result<String, String> {
    let host = url.host_str().ok_or("URL must include a host")?;
    Ok(host.trim_start_matches("www.").to_ascii_lowercase())
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, ..] = ip.octets();
            !(a == 0
                || a == 10
                || a == 127
                || (a == 100 && (64..=127).contains(&b))
                || (a == 169 && b == 254)
                || (a == 172 && (16..=31).contains(&b))
                || (a == 192 && b == 168)
                || (a == 198 && (b == 18 || b == 19))
                || a >= 224)
        }
        IpAddr::V6(ip) => {
            if let Some(mapped) = ip.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            !(ip.is_unspecified()
                || ip.is_loopback()
                || ip.is_multicast()
                || ip.is_unique_local()
                || ip.is_unicast_link_local())
        }
    }
}

async fn validate_public_url(url: &Url, expected_host: &str) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only HTTP and HTTPS URLs are supported".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("URLs containing credentials are not allowed".into());
    }
    if normalized_host(url)? != expected_host {
        return Err("redirect or link left the requested company host".into());
    }

    let host = url.host_str().ok_or("URL must include a host")?;
    let port = url.port_or_known_default().ok_or("URL has no usable port")?;
    let addresses: Vec<_> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| format!("failed to resolve host: {e}"))?
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("local, private, and special-purpose network targets are not allowed".into());
    }
    Ok(())
}

async fn fetch_html(client: &Client, initial_url: Url, expected_host: &str) -> Result<(Url, String), String> {
    let mut url = initial_url;
    for redirect_count in 0..=MAX_REDIRECTS {
        validate_public_url(&url, expected_host).await?;
        let mut response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|e| format!("failed to fetch {url}: {e}"))?;

        if response.status().is_redirection() {
            if redirect_count == MAX_REDIRECTS {
                return Err("too many redirects".into());
            }
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or("redirect response did not include a location")?
                .to_str()
                .map_err(|_| "redirect location was not valid text")?;
            url = url.join(location).map_err(|e| format!("invalid redirect URL: {e}"))?;
            continue;
        }

        if !response.status().is_success() {
            return Err(format!("website returned HTTP {}", response.status()));
        }
        if response.content_length().is_some_and(|length| length > MAX_RESPONSE_BYTES as u64) {
            return Err("website response exceeds the 5 MB limit".into());
        }

        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| format!("failed to read response: {e}"))? {
            if body.len() + chunk.len() > MAX_RESPONSE_BYTES {
                return Err("website response exceeds the 5 MB limit".into());
            }
            body.extend_from_slice(&chunk);
        }
        let html = String::from_utf8_lossy(&body).into_owned();
        return Ok((url, html));
    }
    Err("too many redirects".into())
}

/// Strips HTML tags, script/style tags, and returns normalized plain text.
fn clean_html(html: &str) -> String {
    // 1. Remove comments
    let re_comments = Regex::new(r"(?s)<!--.*?-->").unwrap();
    let html = re_comments.replace_all(html, "");

    // 2. Remove script/style tags and their contents
    let re_scripts = Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
    let html = re_scripts.replace_all(&html, "");

    let re_styles = Regex::new(r"(?is)<style[^>]*>.*?</style>").unwrap();
    let html = re_styles.replace_all(&html, "");

    // 3. Remove all other HTML tags
    let re_tags = Regex::new(r"<[^>]*>").unwrap();
    let text = re_tags.replace_all(&html, " ");

    // 4. Decode basic HTML entities
    let text = text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">");

    // 5. Clean up duplicate spaces and newlines
    let re_whitespace = Regex::new(r"\s+").unwrap();
    let text = re_whitespace.replace_all(&text, " ");

    text.trim().to_string()
}

pub async fn scrape_company_website(url_str: &str) -> Result<ScrapeResult, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(Policy::none())
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let mut url_to_parse = url_str.trim().to_string();
    if !url_to_parse.starts_with("http://") && !url_to_parse.starts_with("https://") {
        url_to_parse = format!("https://{}", url_to_parse);
    }

    let parsed_url = Url::parse(&url_to_parse).map_err(|e| format!("Invalid URL: {e}"))?;
    let base_host = normalized_host(&parsed_url)?;

    // 1. Fetch main page HTML
    let (main_url, main_html) = fetch_html(&client, parsed_url, &base_host).await?;

    let main_text = clean_html(&main_html);
    let mut meaningful_pages = usize::from(looks_meaningful(&main_text));
    let mut crawled_texts = vec![format!(
        "=== Main Page ({}) ===\n{}",
        url_str,
        truncate_chars(&main_text, MAX_CHARS_PER_PAGE)
    )];

    // 2. Extract candidate links, keyed by priority so selection is deterministic.
    let re_href = Regex::new(r#"(?i)href=["']([^"']+)["']"#).unwrap();
    let mut seen: HashSet<String> = HashSet::new();
    // (priority index, discovery order, url) — sorted so /about always beats /team.
    let mut candidates: Vec<(usize, usize, Url)> = Vec::new();

    for cap in re_href.captures_iter(&main_html) {
        let path = &cap[1];

        let Ok(resolved_url) = main_url.join(path) else { continue };
        if !normalized_host(&resolved_url).is_ok_and(|host| host == base_host) {
            continue;
        }
        if resolved_url.path() == "/" || resolved_url.path().is_empty() {
            continue;
        }

        let lower_path = resolved_url.path().to_lowercase();
        let Some(priority) = PAGE_PRIORITIES.iter().position(|kw| lower_path.contains(kw)) else {
            continue;
        };

        let mut key = resolved_url.clone();
        key.set_fragment(None);
        let key = key.to_string();
        if !seen.insert(key) {
            continue;
        }
        candidates.push((priority, candidates.len(), resolved_url));
    }

    candidates.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));

    // 3. Fetch the highest-value subpages
    for (_, _, sub_url) in candidates.into_iter().take(MAX_SUBPAGES) {
        match fetch_html(&client, sub_url.clone(), &base_host).await {
            Ok((final_url, html)) => {
                let cleaned = clean_html(&html);
                if looks_meaningful(&cleaned) {
                    meaningful_pages += 1;
                }
                crawled_texts.push(format!(
                    "\n\n=== Page ({}) ===\n{}",
                    final_url.as_str(),
                    truncate_chars(&cleaned, MAX_CHARS_PER_PAGE)
                ));
            }
            Err(e) => {
                tracing::warn!("Failed to fetch subpage {}: {}", sub_url, e);
            }
        }
    }

    let pages_crawled = crawled_texts.len();
    let quality = if meaningful_pages >= 2 {
        ScrapeQuality::Rich
    } else if meaningful_pages == 1 {
        ScrapeQuality::Thin
    } else {
        ScrapeQuality::Failed
    };

    Ok(ScrapeResult {
        text: crawled_texts.join("\n"),
        quality,
        pages_crawled,
        host: base_host,
    })
}

#[tauri::command]
pub async fn scrape_company(payload: String) -> Result<ScrapeResult, String> {
    scrape_company_website(&payload).await
}

#[cfg(test)]
mod tests {
    use super::{is_public_ip, looks_meaningful, normalized_host, truncate_chars, PAGE_PRIORITIES};
    use reqwest::Url;
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    #[test]
    fn treats_navigation_chrome_as_not_meaningful() {
        let nav = "Home About Careers Contact Sign in Log in Subscribe Accept all cookies Privacy policy Terms of service All rights reserved ".repeat(8);
        assert!(!looks_meaningful(&nav));
    }

    #[test]
    fn treats_real_prose_as_meaningful() {
        let prose = "We build payment infrastructure for online businesses. Our platform processes transactions in over forty countries. Engineering teams work in small autonomous units. We operate our own data centres alongside public cloud capacity. Reliability is measured against a published error budget. ".repeat(4);
        assert!(looks_meaningful(&prose));
    }

    #[test]
    fn rejects_short_pages_even_when_well_formed() {
        assert!(!looks_meaningful("We build things. We ship often. That is all."));
    }

    #[test]
    fn orders_about_ahead_of_team() {
        let about = PAGE_PRIORITIES.iter().position(|k| *k == "about").unwrap();
        let team = PAGE_PRIORITIES.iter().position(|k| *k == "team").unwrap();
        assert!(about < team);
    }

    #[test]
    fn does_not_crawl_individual_job_postings() {
        let path = "/jobs/12345-senior-engineer";
        assert!(!PAGE_PRIORITIES.iter().any(|kw| path.contains(kw)));
    }

    #[test]
    fn truncates_on_character_boundaries() {
        let text = "é".repeat(50);
        let out = truncate_chars(&text, 10);
        assert!(out.starts_with(&"é".repeat(10)));
        assert!(out.contains("page truncated"));
        assert_eq!(truncate_chars("short", 10), "short");
    }

    #[test]
    fn rejects_private_and_special_networks() {
        let blocked = [
            Ipv4Addr::new(127, 0, 0, 1),
            Ipv4Addr::new(10, 0, 0, 1),
            Ipv4Addr::new(100, 64, 0, 1),
            Ipv4Addr::new(169, 254, 169, 254),
            Ipv4Addr::new(172, 16, 0, 1),
            Ipv4Addr::new(192, 168, 0, 1),
            Ipv4Addr::new(198, 18, 0, 1),
        ];
        for ip in blocked {
            assert!(!is_public_ip(IpAddr::V4(ip)), "{ip} must be blocked");
        }
        assert!(!is_public_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)));
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
    }

    #[test]
    fn normalizes_only_the_www_host_prefix() {
        let www = Url::parse("https://www.example.com/about").unwrap();
        let subdomain = Url::parse("https://careers.example.com/").unwrap();
        assert_eq!(normalized_host(&www).unwrap(), "example.com");
        assert_eq!(normalized_host(&subdomain).unwrap(), "careers.example.com");
    }

    #[tokio::test]
    async fn rejects_non_http_https_schemes() {
        let expected_host = "example.com";
        let ftp = Url::parse("ftp://example.com/file.txt").unwrap();
        let file = Url::parse("file:///etc/hosts").unwrap();
        let javascript = Url::parse("javascript:alert(1)").unwrap();

        assert_eq!(
            super::validate_public_url(&ftp, expected_host).await.unwrap_err(),
            "only HTTP and HTTPS URLs are supported"
        );
        assert_eq!(
            super::validate_public_url(&file, expected_host).await.unwrap_err(),
            "only HTTP and HTTPS URLs are supported"
        );
        assert_eq!(
            super::validate_public_url(&javascript, expected_host).await.unwrap_err(),
            "only HTTP and HTTPS URLs are supported"
        );
    }

    #[tokio::test]
    async fn rejects_urls_with_credentials() {
        let expected_host = "example.com";
        let with_user = Url::parse("https://admin@example.com").unwrap();
        let with_pass = Url::parse("https://admin:secret@example.com").unwrap();

        assert_eq!(
            super::validate_public_url(&with_user, expected_host).await.unwrap_err(),
            "URLs containing credentials are not allowed"
        );
        assert_eq!(
            super::validate_public_url(&with_pass, expected_host).await.unwrap_err(),
            "URLs containing credentials are not allowed"
        );
    }

    #[tokio::test]
    async fn preserves_host_boundaries_across_redirects() {
        let expected_host = "example.com";
        let diff_domain = Url::parse("https://attacker.com/about").unwrap();
        let diff_subdomain = Url::parse("https://api.example.com/about").unwrap();

        assert_eq!(
            super::validate_public_url(&diff_domain, expected_host).await.unwrap_err(),
            "redirect or link left the requested company host"
        );
        assert_eq!(
            super::validate_public_url(&diff_subdomain, expected_host).await.unwrap_err(),
            "redirect or link left the requested company host"
        );
    }
}
