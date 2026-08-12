import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography, RECURRING_OPTIONS } from '@/lib/theme';
import { createPlan } from '@/lib/data';
import { RecurringType } from '@/types/database';

export default function NewPlanScreen() {
  const [name, setName] = useState('');
  const [recurring, setRecurring] = useState<RecurringType>('one_off');
  const [nextRunDate, setNextRunDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a plan name');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = await createPlan({
        name: name.trim(),
        recurring,
        next_run_date: nextRunDate || null,
        status: 'draft',
      });
      router.replace(`/plan/${plan.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create plan');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.neutral[700]} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Plan</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.title}>Create a Remittance Plan</Text>
          <Text style={styles.subtitle}>
            Name your plan and set a schedule. You'll add recipients and amounts next.
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Plan name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Monthly Family Support"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Frequency</Text>
          <View style={styles.recurringRow}>
            {RECURRING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setRecurring(opt.value)}
                style={[
                  styles.recurringChip,
                  recurring === opt.value && styles.recurringChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.recurringChipText,
                    recurring === opt.value && styles.recurringChipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Next run date (optional)"
            value={nextRunDate}
            onChangeText={setNextRunDate}
            placeholder="YYYY-MM-DD"
          />

          <Button
            onPress={handleCreate}
            loading={saving}
            style={styles.createBtn}
          >
            Create Plan
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    backgroundColor: '#fff',
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  title: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  subtitle: {
    ...Typography.body,
    color: Colors.neutral[500],
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    backgroundColor: Colors.error[50],
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error[700],
  },
  label: {
    ...Typography.label,
    color: Colors.neutral[700],
    marginBottom: Spacing.sm,
  },
  recurringRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  recurringChip: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 999,
  },
  recurringChipSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  recurringChipText: {
    ...Typography.caption,
    color: Colors.neutral[600],
  },
  recurringChipTextSelected: {
    color: Colors.primary[700],
    fontFamily: 'Inter-SemiBold',
  },
  createBtn: {
    marginTop: Spacing.lg,
    width: '100%',
  },
});
