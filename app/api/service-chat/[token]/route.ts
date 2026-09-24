import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const {
    token,
  } =
    await context.params;

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "birdshop_get_service_chat",
      {
        p_token:
          token,
      }
    );

  if (
    error ||
    !data
  ) {
    return NextResponse.json(
      {
        error:
          "Conversation not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(
    data,
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      token,
    } =
      await context.params;

    const body =
      await request.json();

    const message =
      String(
        body.message ??
          ""
      ).trim();

    if (!message) {
      return NextResponse.json(
        {
          error:
            "Type a message first.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    const {
      error:
        sendError,
    } =
      await supabase.rpc(
        "birdshop_send_service_chat_message",
        {
          p_token:
            token,

          p_body:
            message,
        }
      );

    if (sendError) {
      return NextResponse.json(
        {
          error:
            sendError.message,
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "birdshop_get_service_chat",
        {
          p_token:
            token,
        }
      );

    if (
      error ||
      !data
    ) {
      return NextResponse.json(
        {
          error:
            "Message sent, but the conversation could not be refreshed.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      data
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to send message.",
      },
      {
        status: 500,
      }
    );
  }
}