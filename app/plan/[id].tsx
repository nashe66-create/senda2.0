import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ViewStyle,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingUp,
  Calendar,
  Users,
  CheckCircle2,
  Smartphone,
  Building2,
  Wallet,
  Receipt,
  ChevronRight,
  Repeat,
} from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Spacing, Typography, COUNTRIES, RECURRING_OPTIONS } from '@/lib/theme';
import {
  fetchPlanWithCommitments,
  fetchRecipients,
  addCommitment,
  deleteCommitment,
  updatePlan,
  deletePlan,
  recalcPlanTotals,
  formatGBP,
  formatCurrency,
  formatDate,
  getReceivingMethodLabel,
  getRecurringLabel,
  estimateFxQuote,
  sendPlanTransfers,
} from '@/lib/data';
import { PlanWithCommitments, Recipient, ReceivingMethod, CommitmentWithRecipient } from '@/types/database';

const methodIcons: Record<ReceivingMethod, typeof Smartphone> = {
  mobile_money: Smartphone,
  bank_account: Building2,
  cash_pickup: Wallet,
  bill_payment: Receipt,
};

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanWithCommitments | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [amountGbp, setAmountGbp] = useState('');
  const [quote, setQuote] = useState<{
    rate: number;
    amountDestination: number;
    estimatedFee: number;
    totalCharge: number;
    destinationCurrency: string;
  } | null>(null);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!id) return;
    try {
      const [planData, recipData] = await Promise.all([
        fetchPlanWithCommitments(id),
        fetchRecipients(),
      ]);
      setPlan(planData);
      setRecipients(recipData);
    } catch (e) {
      console.error('Failed to load plan:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [loadPlan])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPlan();
  };

  const updateQuote = useCallback(async () => {
    const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId);
    const amount = Number.parseFloat(amountGbp || '0');
    if (!selectedRecipient || !amount || amount <= 0) {
      setQuote(null);
      return;
    }

    const country = COUNTRIES.find((c) => c.code === selectedRecipient.country);
    const destinationCurrency = country?.currency || 'NGN';
    const nextQuote = await estimateFxQuote(amount, destinationCurrency);
    setQuote(nextQuote);
  }, [amountGbp, recipients, selectedRecipientId]);

  useFocusEffect(
    useCallback(() => {
      void updateQuote();
    }, [updateQuote])
  );

  const handleAddCommitment = async () => {
    if (!selectedRecipientId) {
      setCommitmentError('Please select a recipient');
      return;
    }
    const amount = parseFloat(amountGbp);
    if (!amount || amount <= 0) {
      setCommitmentError('Please enter a valid amount');
      return;
    }

    const recipient = recipients.find((r) => r.id === selectedRecipientId);
    if (!recipient) return;

    const country = COUNTRIES.find((c) => c.code === recipient.country);
    const destinationCurrency = country?.currency || 'NGN';
    const quoteForCommitment = quote ?? (await estimateFxQuote(amount, destinationCurrency));

    setAdding(true);
    setCommitmentError(null);
    try {
      await addCommitment({
        plan_id: id,
        recipient_id: selectedRecipientId,
        amount_gbp: amount,
        destination_currency: destinationCurrency,
        receiving_method: recipient.receiving_method,
        amount_destination: quoteForCommitment.amountDestination,
        fx_rate: quoteForCommitment.rate,
      });
      await recalcPlanTotals(id);
      setShowAddCommitment(false);
      setSelectedRecipientId(null);
      setAmountGbp('');
      setQuote(null);
      await loadPlan();
    } catch (e: any) {
      setCommitmentError(e.message || 'Failed to add commitment');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCommitment = (commitmentId: string) => {
    Alert.alert(
      'Remove recipient',
      'Remove this recipient from the plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteCommitment(commitmentId);
            await recalcPlanTotals(id);
            await loadPlan();
          },
        },
      ]
    );
  };

  const handleApprovePlan = () => {
    if (!plan || plan.commitments.length === 0) return;

    const summary = plan.commitments
      .map((commitment) => {
        const fxRateText = commitment.fx_rate > 0 ? `@ ${commitment.fx_rate} ${commitment.destination_currency}` : 'FX rate pending';
        return `• ${commitment.recipient?.name ?? 'Recipient'}: ${formatGBP(Number(commitment.amount_gbp))} → ${formatCurrency(Number(commitment.amount_destination || 0), commitment.destination_currency)} (${fxRateText})`;
      })
      .join('\n');

    Alert.alert(
      'Approve plan',
      `This saves the plan and gets it ready to send. It does not trigger payment yet.\n\n${summary}\n\nApprove this plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Plan',
          onPress: async () => {
            await updatePlan(id, { status: 'approved' });
            await loadPlan();
            Alert.alert('Plan approved', 'The plan is ready to send. You can send funds when you are ready.');
          },
        },
      ]
    );
  };

  const handleSendPlan = async () => {
    if (!plan || plan.commitments.length === 0) return;

    const summary = plan.commitments
      .map((commitment) => {
        const value = commitment.amount_destination > 0
          ? formatCurrency(Number(commitment.amount_destination), commitment.destination_currency)
          : 'Awaiting quote';
        return `• ${commitment.recipient?.name ?? 'Recipient'}: ${value}`;
      })
      .join('\n');

    Alert.alert(
      'Send funds',
      `This will initiate a Flutterwave transfer for ${formatGBP(Number(plan.total_gbp))}.\n\n${summary}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Now',
          onPress: async () => {
            try {
              if (!plan) return;
              const result = await sendPlanTransfers(plan.id);
              await updatePlan(id, { status: 'processing' });
              await loadPlan();
              Alert.alert('Transfer started', `${result.total} transfer${result.total !== 1 ? 's' : ''} initiated via Flutterwave.`);
            } catch (error: any) {
              Alert.alert('Send failed', error?.message || 'Unable to start transfer.');
            }
          },
        },
      ]
    );
  };

  const handleDeletePlan = () => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this plan? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePlan(id);
            router.push('/(tabs)/plans');
          },
        },
      ]
    );
  };

  if (loading) return <Loading />;

  if (!plan) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={Colors.neutral[700]} size={24} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <EmptyState icon="❌" title="Plan not found" subtitle="This plan may have been deleted" />
      </View>
    );
  }

  const canEdit = plan.status === 'draft';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.neutral[700]} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <StatusBadge status={plan.status} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.titleSection}>
          <View style={styles.planIconLarge}>
            <TrendingUp color="#fff" size={24} strokeWidth={2} />
          </View>
          <Text style={styles.planName}>{plan.name}</Text>
          <View style={styles.planMetaRow}>
            <View style={styles.metaItem}>
              <Users color={Colors.neutral[400]} size={14} strokeWidth={2} />
              <Text style={styles.metaText}>
                {plan.total_recipients} recipient{plan.total_recipients !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Repeat color={Colors.neutral[400]} size={14} strokeWidth={2} />
              <Text style={styles.metaText}>{getRecurringLabel(plan.recurring)}</Text>
            </View>
            {plan.next_run_date && (
              <View style={styles.metaItem}>
                <Calendar color={Colors.neutral[400]} size={14} strokeWidth={2} />
                <Text style={styles.metaText}>{formatDate(plan.next_run_date)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Payment</Text>
          <Text style={styles.totalAmount}>{formatGBP(Number(plan.total_gbp))}</Text>
          <Text style={styles.totalSubtext}>
            One debit from your UK bank account
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recipients in this plan</Text>
          {canEdit && (
            <TouchableOpacity
              onPress={() => setShowAddCommitment(true)}
              style={styles.addBtn}
            >
              <Plus color={Colors.primary[600]} size={18} strokeWidth={2} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {plan.commitments.length === 0 ? (
          <Card style={styles.emptyCommitCard}>
            <Text style={styles.emptyCommitText}>
              No recipients added yet. Add recipients to this plan to start bundling transfers.
            </Text>
            {canEdit && (
              <Button
                onPress={() => setShowAddCommitment(true)}
                variant="outline"
                size="sm"
                style={styles.emptyAddBtn}
              >
                <Plus color={Colors.primary[600]} size={16} strokeWidth={2} /> Add Recipient
              </Button>
            )}
          </Card>
        ) : (
          plan.commitments.map((commitment: CommitmentWithRecipient) => {
            const Icon = methodIcons[commitment.receiving_method] ?? Smartphone;
            const recipient = commitment.recipient;
            const country = recipient
              ? COUNTRIES.find((c) => c.code === recipient.country)
              : null;

            return (
              <Card key={commitment.id} style={styles.commitmentCard}>
                <View style={styles.commitmentHeader}>
                  <View style={styles.commitmentIconWrap}>
                    <Icon color={Colors.primary[600]} size={18} strokeWidth={2} />
                  </View>
                  <View style={styles.commitmentInfo}>
                    <Text style={styles.commitmentName}>
                      {recipient?.name || 'Unknown recipient'}
                    </Text>
                    <View style={styles.commitmentMeta}>
                      <Text style={styles.commitmentMetaText}>
                        {country ? `${country.flag} ${country.name}` : commitment.destination_currency}
                      </Text>
                      <Text style={styles.commitmentDot}>·</Text>
                      <Text style={styles.commitmentMetaText}>
                        {getReceivingMethodLabel(commitment.receiving_method)}
                      </Text>
                    </View>
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => handleDeleteCommitment(commitment.id)}
                      style={styles.deleteCommitBtn}
                    >
                      <Trash2 color={Colors.error[500]} size={16} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.commitmentAmountRow}>
                  <View>
                    <Text style={styles.commitmentAmountLabel}>Amount</Text>
                    <Text style={styles.commitmentAmountGbp}>
                      {formatGBP(Number(commitment.amount_gbp))}
                    </Text>
                  </View>
                  <View style={styles.commitmentArrow}>
                    <ChevronRight color={Colors.neutral[400]} size={16} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={styles.commitmentAmountLabel}>Recipient gets</Text>
                    <Text style={styles.commitmentAmountDest}>
                      {commitment.fx_rate > 0
                        ? formatCurrency(Number(commitment.amount_destination), commitment.destination_currency)
                        : `~ ${commitment.destination_currency}`}
                    </Text>
                  </View>
                </View>

                {commitment.fx_rate > 0 && (
                  <View style={styles.fxRow}>
                    <Text style={styles.fxText}>
                      Rate: 1 GBP = {commitment.fx_rate} {commitment.destination_currency}
                    </Text>
                  </View>
                )}

                {commitment.status !== 'pending' && (
                  <View style={styles.commitmentStatusRow}>
                    <StatusBadge status={commitment.status} />
                  </View>
                )}
              </Card>
            );
          })
        )}

        {canEdit && plan.commitments.length > 0 && plan.status === 'draft' && (
          <Button
            onPress={handleApprovePlan}
            style={styles.confirmBtn}
          >
            <CheckCircle2 color="#fff" size={20} strokeWidth={2} />
            {'  '}Approve Plan
          </Button>
        )}

        {plan.status === 'approved' && plan.commitments.length > 0 && (
          <Button
            onPress={handleSendPlan}
            style={styles.confirmBtn}
          >
            <CheckCircle2 color="#fff" size={20} strokeWidth={2} />
            {'  '}Send Now {formatGBP(Number(plan.total_gbp))}
          </Button>
        )}

        {canEdit && (
          <TouchableOpacity
            onPress={handleDeletePlan}
            style={styles.deletePlanBtn}
          >
            <Trash2 color={Colors.error[500]} size={16} strokeWidth={2} />
            <Text style={styles.deletePlanText}>Delete Plan</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <Modal
        visible={showAddCommitment}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddCommitment(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Recipient to Plan</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddCommitment(false);
                  setSelectedRecipientId(null);
                  setAmountGbp('');
                  setCommitmentError(null);
                }}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {recipients.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyText}>
                  You don't have any recipients yet. Add a recipient first.
                </Text>
                <Button
                  onPress={() => {
                    setShowAddCommitment(false);
                    router.push('/recipient/new');
                  }}
                  size="sm"
                  style={styles.modalAddRecipBtn}
                >
                  <Plus color="#fff" size={16} strokeWidth={2} /> Add Recipient
                </Button>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>Select recipient</Text>
                {recipients.map((r) => {
                  const country = COUNTRIES.find((c) => c.code === r.country);
                  const isSelected = selectedRecipientId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setSelectedRecipientId(r.id)}
                      style={[
                        styles.recipientPickerItem,
                        isSelected && styles.recipientPickerSelected,
                      ]}
                    >
                      <View style={styles.recipientPickerInfo}>
                        <Text style={styles.recipientPickerName}>{r.name}</Text>
                        <Text style={styles.recipientPickerMeta}>
                          {country ? `${country.flag} ${country.name}` : r.country} · {getReceivingMethodLabel(r.receiving_method)}
                        </Text>
                      </View>
                      {isSelected && (
                        <CheckCircle2 color={Colors.primary[600]} size={20} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>
                  Amount in GBP
                </Text>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.amountPrefix}>£</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={amountGbp}
                      onChangeText={setAmountGbp}
                      placeholder="0.00"
                      placeholderTextColor={Colors.neutral[400]}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                </TouchableWithoutFeedback>

                {quote && (
                  <View style={styles.quoteBox}>
                    <Text style={styles.quoteLabel}>Preview</Text>
                    <Text style={styles.quoteText}>Rate: 1 GBP = {quote.rate.toFixed(2)} {quote.destinationCurrency}</Text>
                    <Text style={styles.quoteText}>Receiver gets: {formatCurrency(quote.amountDestination, quote.destinationCurrency)}</Text>
                    <Text style={styles.quoteText}>Transfer fee: {formatGBP(quote.estimatedFee)}</Text>
                    <Text style={styles.quoteText}>Total charge: {formatGBP(quote.totalCharge)}</Text>
                  </View>
                )}

                {commitmentError && (
                  <Text style={styles.commitmentErrorText}>{commitmentError}</Text>
                )}

                <Button
                  onPress={handleAddCommitment}
                  loading={adding}
                  style={styles.modalAddBtn}
                >
                  Add to Plan
                </Button>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  titleSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  planIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  planName: {
    ...Typography.h2,
    color: Colors.neutral[900],
    textAlign: 'center',
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.neutral[500],
  },
  totalCard: {
    backgroundColor: Colors.primary[600],
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: 'center',
    marginVertical: Spacing.md,
    shadowColor: Colors.primary[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  } as ViewStyle,
  totalLabel: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  totalAmount: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginTop: 4,
  },
  totalSubtext: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.neutral[900],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    ...Typography.label,
    color: Colors.primary[600],
  },
  emptyCommitCard: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyCommitText: {
    ...Typography.body,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyAddBtn: {
    marginTop: Spacing.md,
  },
  commitmentCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  } as ViewStyle,
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  commitmentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentInfo: {
    flex: 1,
  },
  commitmentName: {
    ...Typography.bodyMedium,
    color: Colors.neutral[900],
    fontSize: 17,
  },
  commitmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  commitmentMetaText: {
    ...Typography.small,
    color: Colors.neutral[500],
  },
  commitmentDot: {
    ...Typography.small,
    color: Colors.neutral[400],
  },
  deleteCommitBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  commitmentAmountLabel: {
    ...Typography.small,
    color: Colors.neutral[500],
  },
  commitmentAmountGbp: {
    ...Typography.h3,
    color: Colors.neutral[900],
    marginTop: 2,
  },
  commitmentArrow: {
    paddingHorizontal: Spacing.sm,
  },
  commitmentAmountDest: {
    ...Typography.h3,
    color: Colors.neutral[700],
    marginTop: 2,
  },
  fxRow: {
    marginTop: Spacing.sm,
  },
  fxText: {
    ...Typography.small,
    color: Colors.neutral[500],
    fontFamily: 'Inter-Medium',
  },
  commitmentStatusRow: {
    marginTop: Spacing.sm,
  },
  confirmBtn: {
    marginTop: Spacing.lg,
    width: '100%',
  },
  deletePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: 14,
  },
  deletePlanText: {
    ...Typography.bodyMedium,
    color: Colors.error[600],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.neutral[900],
  },
  modalCloseText: {
    ...Typography.body,
    color: Colors.primary[600],
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  modalEmptyText: {
    ...Typography.body,
    color: Colors.neutral[500],
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalAddRecipBtn: {
    paddingHorizontal: Spacing.xl,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalLabel: {
    ...Typography.label,
    color: Colors.neutral[700],
    marginBottom: Spacing.sm,
  },
  recipientPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  recipientPickerSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  recipientPickerInfo: {
    flex: 1,
  },
  recipientPickerName: {
    ...Typography.bodyMedium,
    color: Colors.neutral[900],
  },
  recipientPickerMeta: {
    ...Typography.small,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.neutral[50],
    marginBottom: Spacing.sm,
  },
  amountPrefix: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: Colors.neutral[700],
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xs,
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: Colors.neutral[900],
  },
  quoteBox: {
    backgroundColor: Colors.primary[50],
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  quoteLabel: {
    ...Typography.label,
    color: Colors.primary[700],
    marginBottom: Spacing.xs,
  },
  quoteText: {
    ...Typography.caption,
    color: Colors.neutral[700],
    marginBottom: 4,
  },
  commitmentErrorText: {
    ...Typography.caption,
    color: Colors.error[600],
    marginBottom: Spacing.sm,
  },
  modalAddBtn: {
    marginTop: Spacing.md,
    width: '100%',
  },
});
