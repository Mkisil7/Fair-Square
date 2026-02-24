import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI SDK
// Ensure you have GEMINI_API_KEY set in your .env.local file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const { imageBase64, mimeType } = await req.json();

        if (!imageBase64 || !mimeType) {
            return NextResponse.json(
                { error: 'Missing imageBase64 or mimeType in request body' },
                { status: 400 }
            );
        }

        // Initialize the model as requested
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });

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
`;

        // Strip the data URL prefix if it exists before sending to Gemini
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, '');

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType,
                }
            }
        ];

        // Pass the base64 image and prompt to the model
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Parse the returned text as JSON
        const extractedData = JSON.parse(text);

        return NextResponse.json(extractedData, { status: 200 });

    } catch (error: any) {
        console.error('Error processing receipt:', error);
        return NextResponse.json(
            { error: 'Failed to process receipt', details: error.message },
            { status: 500 }
        );
    }
}
