import { Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useCart } from '@/features/cart/context/CartContext';
import { colors, shadows, spacing } from '@/theme';

const icons = {
  index: ['home', 'home-outline'],
  categories: ['grid', 'grid-outline'],
  favorites: ['heart', 'heart-outline'],
  cart: ['bag-handle', 'bag-handle-outline'],
  profile: ['person', 'person-outline'],
};

/** Configura os separadores públicos com a quantidade confirmada do carrinho. */
export default function CustomerTabsLayout() {
  const { totalQuantity, totalItems } = useCart();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons color={color} name={icons[route.name][focused ? 0 : 1]} size={size} />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: spacing.xs },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
          ...shadows.floating,
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="categories" options={{ title: 'Categorias' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoritos' }} />
      <Tabs.Screen
        name="cart"
        listeners={{
          tabPress: (event) => {
            // O separador não abre um carrinho vazio.
            if (totalQuantity < 1) {
              event.preventDefault();
              Alert.alert('Carrinho vazio', 'Adicione pelo menos um artigo para abrir o carrinho.');
            }
          },
        }}
        options={{ title: 'Carrinho', tabBarBadge: totalItems || undefined }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
