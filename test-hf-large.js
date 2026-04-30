const { HfInference } = require('@huggingface/inference');

const HF_TOKEN = process.env.HF_TOKEN;

async function testLargeModel() {
  const hf = new HfInference(HF_TOKEN);

  // Access a larger model like Llama-2-70b-chat (if available via API)
  const model = 'meta-llama/Llama-2-70b-chat-hf'; // Note: May require Pro subscription

  try {
    const response = await hf.textGeneration({
      model: model,
      inputs: 'Analyze this real estate deed for ghost risk: [Sample deed text here]',
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7
      }
    });

    console.log('HF Model Response:', response.generated_text);
  } catch (error) {
    console.error('Error accessing large model:', error.message);
    // Fallback to smaller model
    console.log('Falling back to smaller model...');
    const smallResponse = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: 'Hello, I need help with document analysis.',
    });
    console.log('Small model response:', smallResponse.generated_text);
  }
}

testLargeModel();