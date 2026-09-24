"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();

  const user =
    userData.user;

  if (userError || !user) {
    redirect("/admin/login");
  }

  const {
    data: adminUser,
    error: adminError,
  } =
    await supabase
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

  if (adminError || !adminUser) {
    redirect("/admin/login");
  }

  return supabase;
}

export async function assignReviewAdmin(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    String(
      formData.get("id") ?? ""
    ).trim();

  const assignedTo =
    String(
      formData.get("assigned_to") ?? ""
    ).trim();

  if (!id) {
    throw new Error(
      "Review ID is required."
    );
  }

  if (
    assignedTo.length < 2 ||
    assignedTo.length > 80
  ) {
    throw new Error(
      "Enter an admin name between 2 and 80 characters."
    );
  }

  const {
    data: review,
    error: reviewError,
  } =
    await supabase
      .from("reviews")
      .select("status")
      .eq("id", id)
      .maybeSingle();

  if (
    reviewError ||
    !review
  ) {
    throw new Error(
      "Unable to find that review."
    );
  }

  if (review.status !== "pending") {
    throw new Error(
      "Only pending reviews can be reassigned."
    );
  }

  const { error } =
    await supabase
      .from("reviews")
      .update({
        assigned_to: assignedTo,
        assigned_at:
          new Date().toISOString(),
      })
      .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to assign review: ${error.message}`
    );
  }

  revalidatePath("/admin/reviews");
}

export async function setReviewStatus(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    String(
      formData.get("id") ?? ""
    );

  const status =
    String(
      formData.get("status") ?? ""
    );

  if (
    !id ||
    ![
      "pending",
      "approved",
      "rejected",
    ].includes(status)
  ) {
    throw new Error(
      "Invalid review update."
    );
  }

  const update =
    status === "approved"
      ? {
          status,
          approved_at:
            new Date().toISOString(),
        }
      : status === "pending"
        ? {
            status,
            approved_at: null,
            featured: false,
          }
        : {
            status,
            approved_at: null,
            featured: false,
          };

  const { error } =
    await supabase
      .from("reviews")
      .update(update)
      .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to update review: ${error.message}`
    );
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  revalidatePath("/admin");
}

export async function toggleReviewFeatured(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    String(
      formData.get("id") ?? ""
    );

  const current =
    String(
      formData.get("featured") ?? "false"
    ) === "true";

  if (!id) {
    throw new Error(
      "Review ID is required."
    );
  }

  const { error } =
    await supabase
      .from("reviews")
      .update({
        featured: !current,
      })
      .eq("id", id)
      .eq("status", "approved");

  if (error) {
    throw new Error(
      `Unable to update featured review: ${error.message}`
    );
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
}

export async function deleteReview(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    String(
      formData.get("id") ?? ""
    );

  if (!id) {
    throw new Error(
      "Review ID is required."
    );
  }

  const { error } =
    await supabase
      .from("reviews")
      .delete()
      .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to delete review: ${error.message}`
    );
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  revalidatePath("/admin");
}
