import { describe, expect, it } from 'vitest'
import { convertChatPayloadToGemini } from './geminiClient'
import type { ChatCompletionPayload } from './openAiTypes'

describe('convertChatPayloadToGemini', () => {
  it('maps system message to systemInstruction and the rest to contents', () => {
    const payload: ChatCompletionPayload = {
      model: 'gemini-3.5-flash',
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an agent.' },
        { role: 'user', content: 'Open settings' },
      ],
    }

    const gemini = convertChatPayloadToGemini(payload)

    expect(gemini.systemInstruction).toEqual({ parts: [{ text: 'You are an agent.' }] })
    expect(gemini.contents).toEqual([
      { role: 'user', parts: [{ text: 'Open settings' }] },
    ])
    expect(gemini.generationConfig).toMatchObject({
      temperature: 0.1,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    })
  })

  it('converts multimodal image_url parts to inline_data', () => {
    const payload: ChatCompletionPayload = {
      model: 'gemini-3.5-flash',
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this screen' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc123' },
            },
          ],
        },
      ],
    }

    const gemini = convertChatPayloadToGemini(payload)

    expect(gemini.contents[0].parts).toEqual([
      { text: 'Describe this screen' },
      { inline_data: { mime_type: 'image/png', data: 'abc123' } },
    ])
  })

  it('maps reasoning_effort to thinkingLevel', () => {
    const payload: ChatCompletionPayload = {
      model: 'gemini-3.5-flash',
      temperature: 0,
      max_tokens: 10,
      reasoning_effort: 'high',
      messages: [{ role: 'user', content: 'hi' }],
    }

    const gemini = convertChatPayloadToGemini(payload)

    expect(gemini.generationConfig?.thinkingConfig).toEqual({ thinkingLevel: 'high' })
  })
})
