import { useState } from 'react';
import { AlertType } from '../components/CustomAlert';

interface AlertConfig {
  type: AlertType;
  title: string;
  message: string;
  hint?: string;
  buttonText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
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
    // Note: The logic for calling callbacks was moved into the component (CustomAlert.tsx) 
    // using handleClose(action). We just toggle visibility here.
  };

  return {
    visible,
    config,
    showAlert,
    hideAlert,
  };
}
