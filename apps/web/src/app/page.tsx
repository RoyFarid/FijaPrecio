import { redirect } from 'next/navigation';

/** El producto vive tras login; el marketing/landing es un proyecto aparte. */
export default function RootPage() {
  redirect('/dashboard');
}
