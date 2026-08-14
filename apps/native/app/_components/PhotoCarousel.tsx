import { useState } from 'react';
import { View, Image, ScrollView, NativeSyntheticEvent, NativeScrollEvent, StyleSheet, useWindowDimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

export const CAROUSEL_HEIGHT = 280;

interface PhotoCarouselProps {
  imageUrls: string[];
}

/**
 * Carousel foto aduan di puncak layar detail: paging horizontal dengan
 * titik indikator dan caption "foto aduan X dari Y". Placeholder muncul
 * saat aduan belum punya foto (warga bisa lapor tanpa foto).
 */
export function PhotoCarousel({ imageUrls }: PhotoCarouselProps) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (imageUrls.length === 0) {
    return (
      <View style={[styles.container, { height: CAROUSEL_HEIGHT, backgroundColor: colors.border }]}>
        <ThemedText color="muted">foto aduan</ThemedText>
      </View>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = e.nativeEvent.layoutMeasurement.width;
    if (pageWidth > 0) {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
    }
  };

  return (
    <View style={[styles.container, { height: CAROUSEL_HEIGHT, backgroundColor: colors.border }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {imageUrls.map((url) => (
          <Image key={url} source={{ uri: url }} style={{ width, height: CAROUSEL_HEIGHT }} />
        ))}
      </ScrollView>

      <View
        style={[
          styles.captionPill,
          {
            top: spacing(3),
            left: spacing(4),
            backgroundColor: colors.textPrimary,
            borderRadius: spacing(3),
            paddingHorizontal: spacing(2),
            paddingVertical: spacing(1),
          },
        ]}
      >
        <ThemedText variant="micro" style={{ color: colors.surface }}>
          foto aduan {index + 1} dari {imageUrls.length}
        </ThemedText>
      </View>

      <View style={[styles.dotsRow, { bottom: spacing(3), gap: spacing(1) }]}>
        {imageUrls.map((url, i) => (
          <View
            key={url}
            style={[
              styles.dot,
              { backgroundColor: colors.surface, opacity: i === index ? 1 : 0.5 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionPill: {
    position: 'absolute',
  },
  dotsRow: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
