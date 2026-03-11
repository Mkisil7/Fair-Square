// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 or mimeType in request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initialize the Google Generative AI SDK
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set')
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Initialize the model as requested
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const prompt = `
You are an intelligent receipt data extraction assistant.
Analyze the provided image of a receipt and extract the following information.
You must return ONLY a strict JSON object matching this schema:
{
  "lineItems": [
    {
      "name": "Item Description",
      "price": 10.99
    }
  ],
  "subtotal": 10.99,
  "tax": 1.00,
  "tip": 2.00,
  "total": 13.99
}
If any value cannot be found, use null. Ensure numbers are represented as floats.
`

    // Strip the data URL prefix if it exists before sending to Gemini
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '')

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType,
        }
      }
    ]

    // Pass the base64 image and prompt to the model
    const result = await model.generateContent([prompt, ...imageParts])
    const responseText = result.response.text()

    // Parse the returned text as JSON
    const extractedData = JSON.parse(responseText)

    return new Response(
      JSON.stringify(extractedData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error('Error processing receipt:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process receipt', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
