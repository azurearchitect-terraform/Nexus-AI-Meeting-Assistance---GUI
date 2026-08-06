with open("src/hooks/useSystemAudio.ts", "r", encoding="utf-8") as f:
    code = f.read()

# Revert isFinal logic
new_start_web_speech = """            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                const delay = res.isFinal ? 100 : 800;
                speechDebounceRef.current = setTimeout(() => {"""
old_start_web_speech = """            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (!res.isFinal) return;
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                speechDebounceRef.current = setTimeout(() => {"""
code = code.replace(old_start_web_speech, new_start_web_speech)
code = code.replace("}, 100);", "}, delay);")

with open("src/hooks/useSystemAudio.ts", "w", encoding="utf-8") as f:
    f.write(code)
