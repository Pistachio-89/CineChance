// src/app/collection/[id]/page.tsx
import CollectionClient from './CollectionClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  
  return <CollectionClient collectionId={id} />;
}
