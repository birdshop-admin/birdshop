import styles from "./AdminIdentityCard.module.css";

type AdminIdentityCardProps = {
  role:
    | "owner"
    | "service_agent";

  displayName:
    string;

  email:
    string | null;
};

export default function AdminIdentityCard({
  role,
  displayName,
  email,
}: AdminIdentityCardProps) {
  const roleLabel =
    role === "owner"
      ? "OWNER"
      : "SERVICE AGENT";

  return (
    <aside
      className={
        styles.card
      }
    >
      <span
        className={
          styles.role
        }
      >
        {
          roleLabel
        }
      </span>

      <strong>
        {
          displayName
        }
      </strong>

      {email && (
        <p>
          {
            email
          }
        </p>
      )}
    </aside>
  );
}