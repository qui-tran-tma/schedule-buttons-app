import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useDevice } from '@/devices/DeviceContext';
import {
  actionSummary,
  channelLabel,
  formatMinuteOfDay,
  toggleWeekday,
  WEEKDAY_LABELS,
  weekdaysLabel,
} from '@/devices/schedules';
import { useSchedules } from '@/devices/useSchedules';
import { Channel, Schedule } from '@/proto/power_board';
import { TimeInput } from './TimeInput';
import { Btn, Card, Chip, colors, styles } from './ui';

export type ScheduleAction = NonNullable<Schedule['action']>;

interface Props {
  title: string;
  /** Default action for a new schedule. */
  newAction: ScheduleAction;
  /** Only list schedules matching this (e.g. one relay channel). */
  filter?(s: Schedule): boolean;
}

export function ScheduleSection({ title, newAction, filter }: Props) {
  const { state } = useDevice();
  const { schedules, loading, maxSchedules, freeSlot, save, remove } = useSchedules();
  const [editing, setEditingRaw] = useState<Schedule | null>(null);
  const [editKey, setEditKey] = useState(0);
  const setEditing = (s: Schedule | null) => {
    if (s) setEditKey((k) => k + 1);
    setEditingRaw(s);
  };
  const list = filter ? schedules.filter(filter) : schedules;
  const connected = state === 'connected';

  if (maxSchedules === 0) {
    return (
      <Card title={title}>
        <Text style={styles.muted}>This device does not support schedules.</Text>
      </Card>
    );
  }

  const startNew = () => {
    if (freeSlot === null) {
      Alert.alert('No free slots', `All ${maxSchedules} schedule slots are used.`);
      return;
    }
    setEditing({ id: freeSlot, enabled: true, minuteOfDay: defaultMinute(), weekdays: 0, action: newAction });
  };

  const toggleEnabled = (s: Schedule, enabled: boolean) => {
    void save({ ...s, enabled }).catch(() => {});
  };

  return (
    <Card
      title={title}
      right={<Btn title="Add" onPress={startNew} disabled={!connected || freeSlot === null} />}
    >
      {loading && list.length === 0 && <Text style={styles.muted}>Loading…</Text>}
      {!loading && list.length === 0 && <Text style={styles.muted}>No schedules.</Text>}
      {list.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit schedule ${formatMinuteOfDay(s.minuteOfDay)}`}
          onPress={() => setEditing(s)}
          disabled={!connected}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.text }}>
            {formatMinuteOfDay(s.minuteOfDay)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{actionSummary(s)}</Text>
            <Text style={styles.muted}>
              {weekdaysLabel(s.weekdays)} · slot {s.id}
            </Text>
          </View>
          <Switch value={s.enabled} disabled={!connected} onValueChange={(v) => toggleEnabled(s, v)} />
        </Pressable>
      ))}
      {editing && (
        <ScheduleEditor
          key={editKey}
          schedule={editing}
          isNew={!schedules.some((s) => s.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={async (s) => {
            await save(s);
            setEditing(null);
          }}
          onDelete={async (id) => {
            await remove(id);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function defaultMinute(): number {
  const d = new Date();
  return (d.getHours() * 60 + d.getMinutes() + 5) % 1440;
}

function ScheduleEditor(props: {
  schedule: Schedule;
  isNew: boolean;
  onCancel(): void;
  onSave(s: Schedule): Promise<void>;
  onDelete(id: number): Promise<void>;
}) {
  const { schedule, isNew } = props;
  const [draft, setDraft] = useState<Schedule>(schedule);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // error banner shown by DeviceContext
    } finally {
      setBusy(false);
    }
  };

  const action = draft.action;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onCancel}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, backgroundColor: colors.bg, flexGrow: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
          {isNew ? 'New schedule' : 'Edit schedule'} (slot {draft.id})
        </Text>

        <TimeInput value={draft.minuteOfDay} onChange={(minuteOfDay) => setDraft({ ...draft, minuteOfDay })} />

        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>Repeat ({weekdaysLabel(draft.weekdays)})</Text>
          <View style={styles.row}>
            {WEEKDAY_LABELS.map((d, i) => (
              <Chip
                key={d}
                label={d}
                selected={((draft.weekdays >> i) & 1) === 1}
                onPress={() => setDraft({ ...draft, weekdays: toggleWeekday(draft.weekdays, i) })}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Chip label="Once" selected={draft.weekdays === 0} onPress={() => setDraft({ ...draft, weekdays: 0 })} />
            <Chip
              label="Mon-Fri"
              selected={draft.weekdays === 0x1f}
              onPress={() => setDraft({ ...draft, weekdays: 0x1f })}
            />
            <Chip
              label="Every day"
              selected={draft.weekdays === 0x7f}
              onPress={() => setDraft({ ...draft, weekdays: 0x7f })}
            />
          </View>
        </View>

        {action?.$case === 'relay' && (
          <View style={{ gap: 8 }}>
            <Text style={styles.muted}>Action on {channelLabel(action.relay.channel)}</Text>
            <View style={styles.row}>
              {[true, false].map((on) => (
                <Chip
                  key={String(on)}
                  label={on ? 'Power ON' : 'Power OFF'}
                  selected={action.relay.powerOn === on}
                  onPress={() =>
                    setDraft({ ...draft, action: { $case: 'relay', relay: { ...action.relay, powerOn: on } } })
                  }
                />
              ))}
            </View>
          </View>
        )}
        {action?.$case === 'press' && <Text style={styles.text}>Action: {actionSummary(draft)}</Text>}

        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.text}>Enabled</Text>
          <Switch value={draft.enabled} onValueChange={(enabled) => setDraft({ ...draft, enabled })} />
        </View>

        <View style={{ gap: 10, marginTop: 'auto' }}>
          <Btn title="Save" busy={busy} onPress={() => void run(() => props.onSave(draft))} />
          {!isNew && (
            <Btn
              title="Delete"
              variant="danger"
              disabled={busy}
              onPress={() => void run(() => props.onDelete(draft.id))}
            />
          )}
          <Btn title="Cancel" variant="secondary" disabled={busy} onPress={props.onCancel} />
        </View>
      </ScrollView>
    </Modal>
  );
}

export function relayFilter(channel: Channel) {
  return (s: Schedule) => s.action?.$case === 'relay' && s.action.relay.channel === channel;
}
