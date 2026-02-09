import QRCode from "qrcode";

/**
 * Generate a QR code data URL for a session code
 * @param code - The session code to encode
 * @returns Promise resolving to a data URL of the QR code image
 */
export async function generateSessionQR(code: string): Promise<string> {
  const url = `${window.location.origin}/join?code=${code}`;

  return await QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
