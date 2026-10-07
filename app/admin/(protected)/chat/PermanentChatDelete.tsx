import SubmitButton from "@/components/SubmitButton";
import { permanentlyDeleteConversation } from "./actions";
import s from "./OwnerAdminChatPage.module.css";
export default function PermanentChatDelete({ id, reference, view, type, page }: { id: string; reference: string; view: string; type: string; page: number }) {
 return <details className={s.permanentControl}>
  <summary>Delete permanently</summary>
  <form action={permanentlyDeleteConversation}>
   <input type="hidden" name="conversation_id" value={id} />
   <input type="hidden" name="return_view" value={view} />
   <input type="hidden" name="return_type" value={type} />
   <input type="hidden" name="return_page" value={page} />
   <p>Erase <strong>{reference}</strong> and its messages? This cannot be undone. Linked orders and payment records stay intact.</p>
   <SubmitButton className={s.dangerButton}>Confirm permanent deletion</SubmitButton>
  </form>
 </details>;
}
