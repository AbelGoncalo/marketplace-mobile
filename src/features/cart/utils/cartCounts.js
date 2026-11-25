/** Conta linhas distintas do carrinho; a quantidade de unidades continua a vir da API. */
export function cartItemCount(data) {
  return (data?.stores || []).reduce((total, store) => total + (store.items?.length || 0), 0);
}
