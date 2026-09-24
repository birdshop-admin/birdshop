import ContactClient from "./ContactClient";

type ContactPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

function firstValue(
  value:
    | string
    | string[]
    | undefined
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return value ?? "";
}

export default async function ContactPage({
  searchParams,
}: ContactPageProps) {
  const params =
    await searchParams;

  return (
    <ContactClient
      initialTopic={firstValue(
        params.topic
      )}
      initialService={firstValue(
        params.service
      )}
      initialPackage={firstValue(
        params.package
      )}
      initialProduct={firstValue(
        params.product
      )}
    />
  );
}