import { GoogleGenAI, Type } from "@google/genai";
import type { Quiz } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const quizSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "A list of quiz questions.",
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: {
            type: Type.STRING,
            description: "The text of the question."
          },
          options: {
            type: Type.ARRAY,
            description: "An array of 4 possible answers.",
            items: { type: Type.STRING }
          },
          correctAnswer: {
            type: Type.STRING,
            description: "The exact text of the correct answer from the options array."
          }
        },
        required: ["questionText", "options", "correctAnswer"]
      }
    }
  },
  required: ["questions"]
};

export const generateQuizFromText = async (text: string, numQuestions: number, difficulty: string, filter: string): Promise<Quiz> => {
  const difficultyInstruction = difficulty === 'Mixed'
    ? 'The questions should have a mix of easy, medium, and hard difficulty levels.'
    : `All questions should be of ${difficulty.toLowerCase()} difficulty.`;

  const filterInstruction = filter.trim()
    ? `- IMPORTANT: The questions must specifically focus on the following topic or theme described here: "${filter.trim()}"`
    : '';

  const prompt = `You are an expert quiz creator. Based on the following context, generate a multiple-choice quiz.
- The quiz should consist of ${numQuestions} questions.
- ${difficultyInstruction}
${filterInstruction ? `${filterInstruction}\n` : ''}- Each question must have 4 distinct options, with only one correct answer.
- Crucially, for each question, the position of the correct answer within the 'options' array must be randomized.
- Ensure the questions test key information from the text, adhering to any focus instructions.
- Respond ONLY with a JSON object that matches the provided schema.

Context:
---
${text}
---
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
      },
    });

    const responseText = response.text.trim();
    const quizData = JSON.parse(responseText);
    
    // Basic validation
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error("Invalid quiz format received from API.");
    }

    return quizData as Quiz;
  } catch (error) {
    console.error("Error generating quiz:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate quiz. ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the quiz.");
  }
};