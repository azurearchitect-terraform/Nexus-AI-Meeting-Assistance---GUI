with open("src/hooks/useSystemAudio.ts", "r", encoding="utf-8") as f:
    code = f.read()

old_block = """                        processWithAI(res.transcript, prompt, conversationRef.current.messages);
                      }, delay);"""
new_block = """                        handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                      }, delay);"""
code = code.replace(old_block, new_block)

old_block2 = """                  processWithAI(res.transcript, prompt, conversationRef.current.messages);
                  }, delay);"""
new_block2 = """                  handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                  }, delay);"""
code = code.replace(old_block2, new_block2)

with open("src/hooks/useSystemAudio.ts", "w", encoding="utf-8") as f:
    f.write(code)
