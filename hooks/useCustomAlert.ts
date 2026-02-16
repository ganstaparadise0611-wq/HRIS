import { useState } from 'react';
import { AlertType } from '../components/CustomAlert';

interface AlertConfig {
  type: AlertType;
  title: string;
  message: string;
  hint?: string;
  buttonText?: string;
  onClose?: () => void;
}

export function useCustomAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    type: 'info',
    title: '',
    message: '',
    hint: '',
    buttonText: '',
  });

  const showAlert = (alertConfig: AlertConfig) => {
    setConfig(alertConfig);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
    if (config.onClose) {
      config.onClose();
    }
  };

  return {
    visible,
    config,
    showAlert,
    hideAlert,
  };
}
