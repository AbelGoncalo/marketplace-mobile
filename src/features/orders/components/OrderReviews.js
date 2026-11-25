import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findReview,
  getReviews,
  reviewTargets,
  saveReview,
} from '@/features/orders/services/reviewsApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const moderation = { PENDING: 'Em moderação', APPROVED: 'Aprovada', REJECTED: 'Não publicada' };

/** Omite a secção enquanto não existem compras recebidas ou avaliações editáveis. */
export function OrderReviews({ token, order }) {
  const targets = reviewTargets(order);
  return targets.length ? <ReviewsContent token={token} targets={targets} /> : null;
}

/** Apresenta ações compactas; carrega os dados próprios antes de permitir uma edição. */
function ReviewsContent({ token, targets }) {
  const loader = useCallback(() => getReviews(token), [token]);
  const query = useApiQuery(loader);
  const [saved, setSaved] = useState({});
  const [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState('');

  /** Atualiza o resumo local com a resposta da API e evita uma segunda criação. */
  function onSaved(target, review) {
    setSaved((current) => ({ ...current, [`${target.kind}-${target.id}`]: review }));
    setSelection(null);
    setNotice('Avaliação guardada e enviada para moderação.');
  }

  return (
    <View style={styles.panel}>
      {/* Cabeçalho discreto de pós-compra, com destaque apenas para a ação de avaliar. */}
      <View style={styles.reviewHeader}>
        <View style={styles.reviewEmblem}>
          <Ionicons name="star-outline" size={23} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading3" style={styles.reviewTitle}>
            A sua opinião conta
          </AppText>
          <AppText variant="caption" color="muted">
            Avalie os produtos e o serviço da sua compra.
          </AppText>
        </View>
      </View>
      {notice ? (
        <AppText accessibilityRole="alert" color="primary">
          {notice}
        </AppText>
      ) : null}
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {query.error ? (
        <>
          <AppText color="danger">{query.error}</AppText>
          <Button label="Tentar novamente" variant="outline" onPress={query.refresh} />
        </>
      ) : null}
      {query.data
        ? targets.map((target) => {
            const review = saved[`${target.kind}-${target.id}`] || findReview(query.data, target);
            // Um identificador no detalhe sem conteúdo na listagem impede uma criação duplicada.
            const unavailable = target.review?.review_id && !review;
            return (
              // Toda a linha é tocável: textos longos mantêm espaço e a ação fica alinhada à direita.
              <Pressable
                key={`${target.kind}-${target.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${unavailable ? 'Atualizar avaliações' : review ? 'Editar avaliação' : 'Avaliar'}: ${target.title}`}
                onPress={() => (unavailable ? query.refresh() : setSelection({ target, review }))}
                style={({ pressed }) => [styles.reviewRow, pressed && styles.reviewRowPressed]}
              >
                <View style={styles.resourceIcon}>
                  <Ionicons
                    name={
                      target.kind === 'products'
                        ? 'bag-outline'
                        : target.kind === 'stores'
                          ? 'storefront-outline'
                          : 'car-outline'
                    }
                    size={19}
                    color={colors.textMuted}
                  />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {target.title}
                  </AppText>
                  <View style={styles.reviewMeta}>
                    {review ? <Ionicons name="star" size={12} color={colors.warning} /> : null}
                    <AppText variant="caption" color="muted" style={styles.metaText}>
                      {review
                        ? `${review.rating}/5 · ${moderation[review.moderation_status] || 'Em atualização'}`
                        : unavailable
                          ? 'Atualize para editar.'
                          : 'Partilhe a sua experiência'}
                    </AppText>
                  </View>
                </View>
                <View style={styles.reviewAction}>
                  <AppText color="primary" variant="caption" style={styles.actionLabel}>
                    {unavailable ? 'Atualizar' : review ? 'Editar' : 'Avaliar'}
                  </AppText>
                  <Ionicons name="chevron-forward" size={15} color={colors.primary} />
                </View>
              </Pressable>
            );
          })
        : null}
      {selection ? (
        <ReviewForm
          token={token}
          target={selection.target}
          review={selection.review}
          onClose={() => setSelection(null)}
          onSaved={onSaved}
          onConflict={() => {
            setSelection(null);
            setNotice('Esta compra já foi avaliada. Atualize e edite a avaliação existente.');
            query.refresh();
          }}
        />
      ) : null}
    </View>
  );
}

/** Formulário com valores originais e bloqueio imediato contra toques repetidos. */
function ReviewForm({ token, target, review, onClose, onSaved, onConflict }) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [anonymous, setAnonymous] = useState(Boolean(review?.is_anonymous));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Não repete automaticamente um envio; a API conserva a autoridade sobre a compra. */
  async function submit() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await saveReview(token, target, review?.id, {
        rating,
        comment,
        is_anonymous: anonymous,
      });
      if (active.current) onSaved(target, result);
    } catch (failure) {
      if (active.current) {
        if (failure.status === 409) onConflict();
        else setError(failure.message || 'Não foi possível guardar a avaliação.');
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  /** Mantém o formulário visível enquanto o servidor processa a alteração. */
  function close() {
    if (!locked.current) onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <View style={styles.flex}>
            <AppText variant="heading2">{review ? 'Editar avaliação' : 'A sua avaliação'}</AppText>
            <AppText color="muted" variant="caption">
              {target.title}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar avaliação"
            disabled={busy}
            onPress={close}
            style={styles.action}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <AppText variant="bodyStrong">Como foi a sua experiência?</AppText>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === rating, disabled: busy }}
                accessibilityLabel={`${value} de 5 estrelas`}
                disabled={busy}
                onPress={() => setRating(value)}
                style={styles.star}
              >
                <Ionicons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={colors.primary}
                />
              </Pressable>
            ))}
          </View>
          <AppText color="muted" variant="caption">
            {rating ? `${rating} de 5 estrelas` : 'Selecione de 1 a 5 estrelas.'}
          </AppText>
          <Input
            label="Comentário (opcional)"
            value={comment}
            onChangeText={setComment}
            editable={!busy}
            multiline
            maxLength={3000}
            placeholder="Conte-nos como correu."
            style={styles.comment}
            helperText={`${[...comment].length}/3000 caracteres`}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Publicar anonimamente</AppText>
              <AppText color="muted" variant="caption">
                Oculta o seu nome na avaliação pública.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Publicar anonimamente"
              value={anonymous}
              onValueChange={setAnonymous}
              disabled={busy}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <AppText color="muted" variant="caption">
            As avaliações são moderadas antes da publicação. Uma edição volta a ser analisada.
          </AppText>
          {error ? (
            <AppText accessibilityRole="alert" color="danger">
              {error}
            </AppText>
          ) : null}
          <Button
            label={review ? 'Guardar alterações' : 'Enviar avaliação'}
            onPress={submit}
            loading={busy}
            disabled={!rating}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// A lista mantém textos flexíveis e um único formulário aberto para reduzir ruído visual.
const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewEmblem: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: { fontSize: 17, lineHeight: 23 },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 68,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  reviewRowPressed: { backgroundColor: colors.background },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { flexShrink: 1 },
  reviewAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionLabel: { fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  action: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  form: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  stars: { flexDirection: 'row', justifyContent: 'center' },
  star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  comment: { minHeight: 120, textAlignVertical: 'top' },
});
