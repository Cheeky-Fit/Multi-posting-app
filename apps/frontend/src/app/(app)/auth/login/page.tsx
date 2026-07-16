export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';
import { authBrandNameServerSide } from '@gitroom/helpers/utils/is.cheeky.server.side';
export const metadata: Metadata = {
  title: `${authBrandNameServerSide()} Login`,
  description: '',
};
export default async function Auth() {
  return <Login />;
}
