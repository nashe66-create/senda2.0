import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '@/lib/theme';
import { PlanStatus, CommitmentStatus, TransactionStatus, KycStatus } from '@/types/database';

function statusConfig(status: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: Colors.neutral[200], text: Colors.neutral[700], label: 'Draft' },
    approved: { bg: Colors.primary[50], text: Colors.primary[700], label: 'Approved' },
    confirmed: { bg: Colors.primary[50], text: Colors.primary[700], label: 'Confirmed' },
    processing: { bg: Colors.warning[50], text: Colors.warning[700], label: 'Processing' },
    completed: { bg: Colors.success[50], text: Colors.success[700], label: 'Completed' },
    failed: { bg: Colors.error[50], text: Colors.error[700], label: 'Failed' },
    pending: { bg: Colors.warning[50], text: Colors.warning[700], label: 'Pending' },
    successful: { bg: Colors.success[50], text: Colors.success[700], label: 'Successful' },
    refunded: { bg: Colors.neutral[200], text: Colors.neutral[700], label: 'Refunded' },
    unverified: { bg: Colors.neutral[200], text: Colors.neutral[700], label: 'Unverified' },
    verified: { bg: Colors.success[50], text: Colors.success[700], label: 'Verified' },
    rejected: { bg: Colors.error[50], text: Colors.error[700], label: 'Rejected' },
  };
  return map[status] ?? map.draft;
}

interface StatusBadgeProps {
  status: PlanStatus | CommitmentStatus | TransactionStatus | KycStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig(status);
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: 999,
    alignSelf: 'flex-start',
  } as ViewStyle,
  text: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    fontWeight: '600',
  } as TextStyle,
});
