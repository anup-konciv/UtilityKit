export type TranslationProvider = 'LibreTranslate' | 'MyMemory';

export type TranslationResponse = {
  text: string;
  provider: TranslationProvider;
};

function normalizeLibreTranslateUrl(rawUrl?: string) {
  const base = (rawUrl || 'https://libretranslate.com').trim().replace(/\/+$/, '');
  return base.endsWith('/translate') ? base : `${base}/translate`;
}

async function translateWithLibreTranslate(
  text: string,
  source: string,
  target: string,
): Promise<TranslationResponse> {
  const url = normalizeLibreTranslateUrl(process.env.EXPO_PUBLIC_TRANSLATE_API_URL);
  const apiKey = process.env.EXPO_PUBLIC_TRANSLATE_API_KEY?.trim();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: 'text',
      ...(apiKey ? { api_key: apiKey } : {}),
    }),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || typeof json?.translatedText !== 'string') {
    throw new Error(
      json?.error || json?.message || 'Primary translation provider failed.',
    );
  }

  return {
    text: json.translatedText,
    provider: 'LibreTranslate',
  };
}

async function translateWithMyMemory(
  text: string,
  source: string,
  target: string,
): Promise<TranslationResponse> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));

  if (json?.responseStatus !== 200 || typeof json?.responseData?.translatedText !== 'string') {
    throw new Error(json?.responseDetails || 'Backup translation provider failed.');
  }

  return {
    text: json.responseData.translatedText,
    provider: 'MyMemory',
  };
}

export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<TranslationResponse> {
  if (source === target) {
    return {
      text,
      provider: 'LibreTranslate',
    };
  }

  try {
    return await translateWithLibreTranslate(text, source, target);
  } catch (primaryError) {
    try {
      return await translateWithMyMemory(text, source, target);
    } catch (backupError) {
      const message =
        backupError instanceof Error
          ? backupError.message
          : primaryError instanceof Error
            ? primaryError.message
            : 'Translation failed. Please try again.';

      throw new Error(message);
    }
  }
}
