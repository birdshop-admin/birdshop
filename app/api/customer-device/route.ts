import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  isUuid,
  privateHeaders,
  PublicError,
  readBody,
} from "@/lib/server-config";
import { inboxError } from "@/lib/customer-inbox";
import {
  forgetCustomerDevice,
  readCustomerDevice,
  rememberDeviceChat,
} from "@/lib/customer-device";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams,
      id = query.get("conversationId");
    if (id && !isUuid(id)) throw new PublicError("Invalid conversation.", 400);
    const device = await readCustomerDevice();
    if (!device)
      return Response.json(
        id ? { remembered: false } : { conversations: [], nextOffset: null },
        { headers: privateHeaders },
      );
    await rateLimit("device-read", device.hash, 60, 60);
    const db = createAdminClient();
    if (id) {
      const { data, error } = await db.rpc("birdshop_open_device_chat", {
        p_device_hash: device.hash,
        p_conversation_id: id,
      });
      if (error) throw new Error("Device lookup unavailable");
      return Response.json({ remembered: !!data }, { headers: privateHeaders });
    }
    const offset = Number(query.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new PublicError("Invalid page.", 400);
    const { data, error } = await db.rpc("birdshop_list_device_chats", {
      p_device_hash: device.hash,
      p_offset: offset,
    });
    if (error) throw new Error("Device inbox unavailable");
    const rows = data ?? [];
    return Response.json(
      {
        conversations: rows.slice(0, 50),
        nextOffset: rows.length > 50 ? offset + 50 : null,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return inboxError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = JSON.parse(await readBody(request, 2048));
    if (body.action === "remember") {
      await limitRequest(request, "device-remember", 30, 900);
      if (
        typeof body.token !== "string" ||
        body.token.length < 20 ||
        body.token.length > 200
      )
        throw new PublicError("Conversation unavailable.", 404);
      if (!(await rememberDeviceChat(body.token)))
        throw new PublicError("Conversation unavailable.", 404);
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (body.action !== "open" || !isUuid(body.conversationId))
      throw new PublicError("Conversation unavailable.", 404);
    const device = await readCustomerDevice();
    if (!device)
      throw new PublicError(
        "Saved access has expired. Open your private link or verify your email.",
        401,
      );
    await rateLimit("device-open", device.hash, 30, 60);
    const { data, error } = await createAdminClient().rpc(
      "birdshop_open_device_chat",
      { p_device_hash: device.hash, p_conversation_id: body.conversationId },
    );
    if (error) throw new Error("Unable to open chat");
    if (!data)
      throw new PublicError(
        "Conversation unavailable. Refresh your inbox or verify your email.",
        404,
      );
    return Response.json(
      { url: `/service-chat?token=${encodeURIComponent(data)}` },
      { headers: privateHeaders },
    );
  } catch (error) {
    return inboxError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const id = new URL(request.url).searchParams.get("conversationId");
    if (!id) {
      await forgetCustomerDevice();
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (!isUuid(id)) throw new PublicError("Invalid conversation.", 400);
    const device = await readCustomerDevice();
    if (device) {
      const { error } = await createAdminClient()
        .from("birdshop_customer_device_chats")
        .delete()
        .eq("device_hash", device.hash)
        .eq("conversation_id", id);
      if (error) throw new Error("Unable to forget chat");
    }
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    return inboxError(error);
  }
}
