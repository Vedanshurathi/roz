import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { isoDateSchema, uuidSchema } from '@rozbazaar/shared';
import { keys, useOrders } from '../../api/queries';

/** The order in the URL (/order/:date/:id), read from that day's list so a refresh still works. */
export function useOrder() {
  const params = useParams();
  const date = isoDateSchema.safeParse(params.date).success ? params.date! : '';
  const id = uuidSchema.safeParse(params.id).success ? params.id! : '';
  const q = useOrders(date);
  const qc = useQueryClient();
  const order = q.data?.find((b) => b.id === id) ?? null;
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.orders(date) }),
      qc.invalidateQueries({ queryKey: keys.stats }),
    ]);
  return { date, id, q, order, refresh, base: `/order/${date}/${id}` };
}
