import Anthropic from '@anthropic-ai/sdk';

export async function golfCode(
  code: string,
  language: string,
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  const prompt = `You are an expert at code golfing - the art of writing the shortest possible code that accomplishes the same task. 

Given the following ${language} code, rewrite it to be as short as possible while maintaining the exact same functionality. Use all possible tricks and techniques:
- Shorter variable names
- Remove unnecessary whitespace
- Use ternary operators instead of if/else
- Combine operations
- Use shorthand syntax
- Remove unnecessary parentheses
- Use implicit returns
- Leverage language-specific shortcuts

IMPORTANT: 
- The output must be valid, working ${language} code
- Preserve the exact same functionality
- Return ONLY the golfed code, no explanations

Original code:
${code}

Golfed code:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to golf code: ${error.message}`);
    }
    throw new Error('Failed to golf code');
  }
}

export async function ungolfCode(
  code: string,
  language: string,
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  const prompt = `You are an expert at making code more readable and maintainable. 

Given the following minified/golfed ${language} code, rewrite it to be as readable and well-structured as possible:
- Use descriptive variable and function names
- Add proper indentation and formatting
- Break complex expressions into multiple lines
- Add helpful comments where appropriate
- Use clear control flow structures
- Follow ${language} best practices and conventions
- Expand shorthand syntax to be more explicit
- Add whitespace for readability

IMPORTANT: 
- The output must be valid, working ${language} code
- Preserve the exact same functionality
- Make the code as clear and maintainable as possible
- Return ONLY the refactored code

Minified code:
${code}

Readable code:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to ungolf code: ${error.message}`);
    }
    throw new Error('Failed to ungolf code');
  }
}