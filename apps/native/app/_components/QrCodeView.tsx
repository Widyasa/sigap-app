import QRCode from 'react-native-qrcode-svg';

interface QrCodeViewProps {
  value: string;
  size: number;
  color: string;
  backgroundColor: string;
}

/**
 * QR Code renderer untuk native (iOS/Android) via react-native-qrcode-svg.
 */
export function QrCodeView({ value, size, color, backgroundColor }: QrCodeViewProps) {
  // ASUMSI: Menggunakan react-native-qrcode-svg atas permintaan pengguna untuk dukungan QR code di mobile.
  return (
    <QRCode
      value={value}
      size={size}
      color={color}
      backgroundColor={backgroundColor}
    />
  );
}
