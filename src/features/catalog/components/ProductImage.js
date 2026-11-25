import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { productImageUrl } from '@/features/catalog/utils/productPresentation';
import { colors } from '@/theme';

/** Mostra uma alternativa visual quando a imagem está ausente ou não carrega. */
export function ProductImage({ path, label, style }) {
  const uri = productImageUrl(path);
  const [failedUri, setFailedUri] = useState(null);
  return (
    <View style={[styles.container, style]}>
      {uri && failedUri !== uri ? (
        <Image
          accessibilityLabel={label}
          onError={() => setFailedUri(uri)}
          resizeMode="contain"
          source={{ uri }}
          style={styles.image}
        />
      ) : (
        <Ionicons
          accessibilityLabel="Imagem indisponível"
          name="image-outline"
          size={56}
          color={colors.textMuted}
        />
      )}
    </View>
  );
}

// Mantém a área da imagem estável durante o carregamento e em caso de erro.
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    height: 160,
  },
  image: { height: '100%', width: '100%' },
});
