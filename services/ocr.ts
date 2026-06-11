import * as ImageManipulator from 'expo-image-manipulator';

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function extractTextFromImage(imageUri: string): Promise<OcrResult> {
  // Preprocess: resize to 1500px wide for better OCR accuracy
  const processed = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1500 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Try on-device OCR (requires EAS custom build with react-native-text-recognition installed)
  // Falls back gracefully to empty string so the user can enter values manually
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TextRecognition = require('react-native-text-recognition');
    const lines: string[] = await TextRecognition.default.recognize(processed.uri);
    return { text: lines.join('\n'), confidence: 0.9 };
  } catch {
    return { text: '', confidence: 0 };
  }
}

export async function preprocessImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1500 } }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
