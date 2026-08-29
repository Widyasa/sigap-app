import { Image } from 'react-native';

interface QrCodeViewProps {
  value: string;
  size: number;
  color: string;
  backgroundColor: string;
}

/**
 * QR Code renderer untuk web via Image URL (tanpa modul native-only).
 */
export function QrCodeView({ value, size }: QrCodeViewProps) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(value)}&size=${size}x${size}`;
  return (
    <Image
      source={{ uri: qrUrl }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
