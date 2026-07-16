import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const isCheekyModeServerSide = () => {
  return process.env.NEXT_PUBLIC_CHEEKY_MODE === 'true';
};

export const authBrandNameServerSide = () => {
  if (isCheekyModeServerSide()) {
    return 'Cheeky Social';
  }

  return isGeneralServerSide() ? 'Postiz' : 'Gitroom';
};
