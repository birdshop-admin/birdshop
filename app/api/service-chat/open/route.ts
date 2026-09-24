import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const reference =
      String(
        body.reference ??
          ""
      ).trim();

    const contact =
      String(
        body.contact ??
          ""
      ).trim();

    if (
      !reference ||
      !contact
    ) {
      return NextResponse.json(
        {
          error:
            "Enter your service reference and contact information.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "birdshop_open_service_chat",
        {
          p_reference:
            reference,

          p_contact:
            contact,
        }
      );

    if (
      error ||
      !data
    ) {
      return NextResponse.json(
        {
          error:
            error?.message ??
            "Unable to open that service chat.",
        },
        {
          status: 403,
        }
      );
    }

    return NextResponse.json({
      token:
        String(data),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to open service chat.",
      },
      {
        status: 500,
      }
    );
  }
}