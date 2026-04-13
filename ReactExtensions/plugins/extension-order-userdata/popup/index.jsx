import { FormPanel } from '@/popup/components/FormPanel/index.jsx';
import { LogPanel } from '@/popup/components/LogPanel/index.jsx';
import { ProgressPanel } from '@/popup/components/ProgressPanel/index.jsx';
import { useOrderUserdataPopupController } from '@/popup/hooks/useOrderUserdataPopupController.js';
import '@/popup/styles.css';

export function PopupPage() {
  const { form, progress, logs, isStarting, isRunning, setFormField, onStart, onStop, onClearLogs } =
    useOrderUserdataPopupController();

  return (
    <div className="ou-popup-layout">
      <section className="ou-popup-layout-left">
        <FormPanel
          form={form}
          isStarting={isStarting}
          isRunning={isRunning}
          onFieldChange={setFormField}
          onStart={onStart}
          onStop={onStop}
        />
        <ProgressPanel progress={progress} />
      </section>
      <section className="ou-popup-layout-right">
        <LogPanel logs={logs} onClear={onClearLogs} />
      </section>
    </div>
  );
}


