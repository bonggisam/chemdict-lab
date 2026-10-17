import { analogTypes, digitalTypes, type ResolvedSensor } from '../lib/sensors';

interface Props {
  sensors: ResolvedSensor[];
  disabled: boolean;
  onSetPort: (port: string, type: string) => void;
  onRescan?: () => void;
}

const PORTS = ['A0', 'A1', 'A2', 'A3'];

/** 아날로그 포트마다 꽂은 센서 종류를 고르고, 디지털 센서는 자동 인식 결과를 보여 줌 */
export function SensorSetup({ sensors, disabled, onSetPort, onRescan }: Props) {
  const digital = sensors.filter((s) => !/^A\d$/.test(s.src));
  return (
    <section className="setup">
      <div className="setup-head">
        <h2>센서 연결</h2>
        <p className="note">아날로그 센서는 꽂은 포트에 맞춰 종류를 고르세요. 설정은 보드에 저장됩니다.</p>
      </div>
      <div className="ports">
        {PORTS.map((port) => {
          const s = sensors.find((x) => x.src === port);
          const type = s?.type ?? 'OFF';
          const spec = analogTypes.find((t) => t.type === type);
          return (
            <label key={port} className={`port ${type === 'OFF' ? 'off' : ''}`}>
              <span className="port-name">{port}</span>
              <select
                id={`port-${port}`}
                value={type}
                disabled={disabled}
                onChange={(e) => onSetPort(port, e.target.value)}
              >
                <option value="OFF">사용 안 함</option>
                {analogTypes.map((t) => (
                  <option key={t.type} value={t.type}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>
                ))}
              </select>
              <span className="port-note">
                {spec ? spec.note : '꽂은 센서가 없으면 꺼 두세요.'}
                {s && spec?.cal.kind !== 'none' && <b className={s.cal ? 'ok' : 'warn'}>{s.cal ? ' · 보정됨' : spec?.requiresCal ? ' · 보정 필요' : ' · 보정 전'}</b>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="digital">
        <span className="note">자동 인식</span>
        {onRescan && <button className="ghost small" disabled={disabled} onClick={onRescan}>센서 다시 찾기</button>}
        {digital.length === 0 && <span className="note">디지털 센서 없음 (DS18B20은 D2, Modulino는 Qwiic 단자)</span>}
        {digital.map((s) => (
          <span key={s.id} className="chip">
            {s.displayName}
            <small>{digitalTypes.find((d) => d.type === s.type)?.note ?? s.src}</small>
          </span>
        ))}
      </div>
    </section>
  );
}
