import type {
  FutureAuditResult,
  FuturePillar,
  FutureAuditQuestion,
  FutureAuditRecommendation,
  FutureAuditSummary,
} from '../types';
import type { AuditSession, AuditSessionItem, AuditItemResponse } from '../types';
import type { AuditAnalysisResult } from '@/types/analysis';
import { AUDIT_PILLARS, PILLAR_META } from '../constants/pillars';
import type { AuditPillar } from '../constants/pillars';

// Standard 5S checklist definitions (Exactly 4 questions per pillar)
export interface StandardQuestionDef {
  id: string;
  question: string;
  benchmark: string;
  defaultEvidence: Record<'good' | 'average' | 'bad', string>;
  defaultReason: Record<'good' | 'average' | 'bad', string>;
  defaultRecommendation: string;
}

export const STANDARD_5S_QUESTIONS: Record<AuditPillar, StandardQuestionDef[]> = {
  SORT: [
    {
      id: 'SORT_001',
      question: 'Workplace clutter',
      benchmark: 'Work surfaces, walkways, and storage zones must be free of non-essential items.',
      defaultEvidence: {
        good: 'All walkways and workstation tables are completely clear of clutter.',
        average: 'Minor clutter observed on the side tables; main work surfaces are clear.',
        bad: 'Significant clutter, empty boxes, and loose parts are blocking the station.',
      },
      defaultReason: {
        good: 'Only active production items are in the designated work area.',
        average: 'A few unneeded items remain near the corner of the station.',
        bad: 'Workspace contains accumulated scrap material and unused shipping containers.',
      },
      defaultRecommendation: 'Perform sorting sweeps at shift handover to move non-essential items to quarantine.',
    },
    {
      id: 'SORT_002',
      question: 'Unnecessary tools',
      benchmark: 'Only tools required for the active process should be present at the workstation.',
      defaultEvidence: {
        good: 'Only tools currently in use are present at the workstation.',
        average: 'A couple of idle tools from previous shifts were found on the bench.',
        bad: 'Multiple unused hand tools, jigs, and fixtures cluttering the operator area.',
      },
      defaultReason: {
        good: 'Operator has successfully stored unneeded tools in tool cabinets.',
        average: 'Idle tools remain on the bench after operation ended.',
        bad: 'No process in place to return specialized tools to central storage.',
      },
      defaultRecommendation: 'Establish a red-tag area for tools that have not been used in the past 24 hours.',
    },
    {
      id: 'SORT_003',
      question: 'Unused equipment',
      benchmark: 'Redundant, broken, or unused machinery and shelving must be removed or tagged.',
      defaultEvidence: {
        good: 'All machines and storage fixtures in the area are active and functional.',
        average: 'An outdated label printer is sitting unused on the shelf.',
        bad: 'Broken testing equipment and outdated terminal displays are taking up bench space.',
      },
      defaultReason: {
        good: 'Damaged or decommissioned equipment was prompt removed to maintenance.',
        average: 'Unused hardware has not been decommissioned yet.',
        bad: 'Equipment replacement occurred without discarding the broken units.',
      },
      defaultRecommendation: 'Relocate inactive or broken machinery to the quarantine zone for disposal.',
    },
    {
      id: 'SORT_004',
      question: 'Obsolete documents',
      benchmark: 'Postings, SOPs, and instruction sheets must be current and authorized.',
      defaultEvidence: {
        good: 'All visible work instructions and documents are up-to-date.',
        average: 'An old version of the shift schedule is still pinned to the bulletin board.',
        bad: 'Expired safety datasheets and dirty handwritten notes are taped to the desk.',
      },
      defaultReason: {
        good: 'The documentation audit was completed last week, removing old copies.',
        average: 'Most SOP sheets are current, but older revision copies remain nearby.',
        bad: 'Documentation standards are not being enforced, leading to outdated instructions.',
      },
      defaultRecommendation: 'Audit all clipboards and reference guides, discarding obsolete revisions.',
    },
  ],
  SET_IN_ORDER: [
    {
      id: 'SET_001',
      question: 'Designated locations',
      benchmark: 'Every item must have a designated, labeled storage location (shadow boards, labels).',
      defaultEvidence: {
        good: 'All tools are in labeled slots on the shadow board.',
        average: 'Most parts have labeled bins, but some rest in unmarked staging zones.',
        bad: 'No labeled locations present; parts and tools are piled haphazardly.',
      },
      defaultReason: {
        good: 'Labels and silhouette cutouts are used for all active items.',
        average: 'Staging labels are peeling off or partially missing.',
        bad: 'Workstation lacks visual controls for storage.',
      },
      defaultRecommendation: 'Apply vinyl labels and tool outlines to the workbench and pegboard.',
    },
    {
      id: 'SET_002',
      question: 'Visual boundaries',
      benchmark: 'Walkways, aisles, and staging zones must be clearly demarcated.',
      defaultEvidence: {
        good: 'Floor marking tape clearly outlines walkways and safety zones.',
        average: 'Floor tape is worn out or torn in high-traffic passageways.',
        bad: 'No floor markings or safety stripes exist in this work area.',
      },
      defaultReason: {
        good: 'Durable yellow tape is maintained to guide material placement.',
        average: 'Friction from forklifts has damaged parts of the floor markings.',
        bad: 'Layout boundaries were never established or taped.',
      },
      defaultRecommendation: 'Repaint or re-tape boundary lines to define active zones and walkways.',
    },
    {
      id: 'SET_003',
      question: 'Tool accessibility',
      benchmark: 'Tools must be organized near their point of use to minimize operator travel.',
      defaultEvidence: {
        good: 'Hand tools are organized directly in the operator\'s immediate reach.',
        average: 'Tools are stored in a drawer, requiring search time.',
        bad: 'Operators must walk to a separate cabinet to fetch standard tools.',
      },
      defaultReason: {
        good: 'Ergonomic workbench layout places primary tools in the comfort zone.',
        average: 'Some secondary tools are stored further away than necessary.',
        bad: 'Tools are scattered, requiring searching before task initiation.',
      },
      defaultRecommendation: 'Re-arrange tool storage to keep high-frequency tools closest to the user.',
    },
    {
      id: 'SET_004',
      question: 'Missing item indicators',
      benchmark: 'Visual cues must indicate when an item is missing or in use.',
      defaultEvidence: {
        good: 'Shadow boards display empty outlines when tools are in use.',
        average: 'Labels indicate where tools belong, but lack silhouette outlines.',
        bad: 'No visual feedback is available to detect missing items.',
      },
      defaultReason: {
        good: 'Clean silhouettes immediately expose missing socket wrenches.',
        average: 'Text labels are present, but outlines are missing.',
        bad: 'Losing tools goes unnoticed until the end of the shift.',
      },
      defaultRecommendation: 'Install shadow outlines on tool panels to show empty spots instantly.',
    },
  ],
  SHINE: [
    {
      id: 'SHINE_001',
      question: 'Clean floors & aisles',
      benchmark: 'Walkways and work area floors must be swept, dry, and free of spills/litter.',
      defaultEvidence: {
        good: 'Floor is completely clean, dry, and free of oil spots or debris.',
        average: 'Minor dust and small cardboard shavings are visible on the floor.',
        bad: 'Puddles of oil and loose plastic wrap debris create safety hazards.',
      },
      defaultReason: {
        good: 'Operators clean the floor regularly during shift transitions.',
        average: 'Sweeping was done, but some debris accumulated during the shift.',
        bad: 'Spill cleanup has been neglected for multiple shifts.',
      },
      defaultRecommendation: 'Mop floor surfaces and sweep away metal shavings immediately.',
    },
    {
      id: 'SHINE_002',
      question: 'Clean machines & tools',
      benchmark: 'Workstations, machinery, and tools must be clean, free of dust, grease, and grime.',
      defaultEvidence: {
        good: 'All machines and hand tools are clean and wiped down.',
        average: 'A light layer of dust has settled on the machine housing.',
        bad: 'Tools are covered in sticky hydraulic oil and grime.',
      },
      defaultReason: {
        good: 'Wipe-downs are integrated into the daily workstation checklist.',
        average: 'Work surfaces are clean, but machine sides are dusty.',
        bad: 'Workbenches have not been wiped down, leaving oil residues.',
      },
      defaultRecommendation: 'Implement a mandatory 5-minute wipe-down period at the end of each shift.',
    },
    {
      id: 'SHINE_003',
      question: 'Cleaning tool availability',
      benchmark: 'Cleaning supplies must be clean and organized in designated storage.',
      defaultEvidence: {
        good: 'Brooms, sprays, and cloths are organized in the 5S cleaning station.',
        average: 'Cleaning supplies are present, but are stored untidily.',
        bad: 'No cleaning supplies are located in the vicinity of this station.',
      },
      defaultReason: {
        good: 'Dedicated cleaning supply rack is labeled and fully stocked.',
        average: 'Wipes are running low and brooms are lying on the floor.',
        bad: 'Operators must search other departments to find cleaning tools.',
      },
      defaultRecommendation: 'Create a localized 5S cleaning station containing brooms, dustpans, and sanitizers.',
    },
    {
      id: 'SHINE_004',
      question: 'Waste bin maintenance',
      benchmark: 'Trash and recycling bins must be labeled, available, and emptied regularly.',
      defaultEvidence: {
        good: 'All waste bins are labeled and less than half full.',
        average: 'Waste bins are getting full but are not overflowing yet.',
        bad: 'Trash bin is overflowing, spilling waste onto the surrounding floor.',
      },
      defaultReason: {
        good: 'Bin emptying schedule matches material throughput speed.',
        average: 'Bins are labeled, but emptying is slightly behind schedule.',
        bad: 'Bins are unlabeled and have not been emptied today.',
      },
      defaultRecommendation: 'Empty the waste bins and ensure recycling categories are clearly labeled.',
    },
  ],
  STANDARDIZE: [
    {
      id: 'STAND_001',
      question: 'Visual standards',
      benchmark: 'SOPs, visual control sheets, and standard work guidelines must be posted.',
      defaultEvidence: {
        good: '5S visual standard sheet is mounted clearly at eye-level.',
        average: 'SOP sheet is present but is dirty and hard to read.',
        bad: 'No visual standards or 5S documentation are visible.',
      },
      defaultReason: {
        good: 'Laminated visual aids show correct vs incorrect workstation states.',
        average: 'Visual sheet exists, but is obscured behind other documents.',
        bad: 'No training aids or visual guides are provided for reference.',
      },
      defaultRecommendation: 'Laminate and mount the 5S Visual Standard sheet at the operator console.',
    },
    {
      id: 'STAND_002',
      question: 'Consistent labeling',
      benchmark: 'Standardized color schemes and naming must be used across the facility.',
      defaultEvidence: {
        good: 'Labeling follows the corporate color-coding standard.',
        average: 'Labeling is present but uses hand-written tape rather than printed labels.',
        bad: 'Inconsistent labels make locating parts confusing.',
      },
      defaultReason: {
        good: 'Industrial label makers are used for unified typeface and color.',
        average: 'Temporary masking tape labels have not been replaced.',
        bad: 'Inconsistent labeling styles exist, causing worker confusion.',
      },
      defaultRecommendation: 'Replace temporary markers with standard color-coded thermal-printed labels.',
    },
    {
      id: 'STAND_003',
      question: 'Uniform workstation layout',
      benchmark: 'Workstation layouts must remain uniform and consistent across shifts.',
      defaultEvidence: {
        good: 'Workstation layout exactly matches the standard diagram.',
        average: 'Layout is generally correct, but containers are swapped.',
        bad: 'Layout varies significantly, forcing operators to reorganize.',
      },
      defaultReason: {
        good: 'Strict adherence to standard workbench configuration.',
        average: 'Operators rearranged small bins to suit personal preferences.',
        bad: 'No standard workstation layout diagram exists for comparison.',
      },
      defaultRecommendation: 'Post a workbench layout diagram and audit setup compliance daily.',
    },
    {
      id: 'STAND_004',
      question: 'Visual controls',
      benchmark: 'Status indicators, andon lights, or kanbans must be functional.',
      defaultEvidence: {
        good: 'Kanban cards and workstation status indicators are active and correct.',
        average: 'Kanban cards are present, but are stored out of order.',
        bad: 'Visual control systems are completely neglected or inactive.',
      },
      defaultReason: {
        good: 'Material replenishment limits are clearly controlled visually.',
        average: 'Staging bins are labeled, but limit cards are missing.',
        bad: 'No visual indicators exist to manage buffer storage levels.',
      },
      defaultRecommendation: 'Implement visual min-max levels on all staging racks to control inventory.',
    },
  ],
  SUSTAIN: [
    {
      id: 'SUST_001',
      question: 'Audit schedule adherence',
      benchmark: 'Audit logs must prove scheduled checks are performed consistently.',
      defaultEvidence: {
        good: 'Audit log is signed off weekly, showing active compliance.',
        average: 'The audit schedule is posted, but two audits were missed.',
        bad: 'Audit sheets have not been filled in or signed for over a month.',
      },
      defaultReason: {
        good: 'Area supervisor enforces weekly self-audits.',
        average: 'Audit frequency slipped during high-production weeks.',
        bad: 'Audit tracking is inactive at this workstation.',
      },
      defaultRecommendation: 'Assign a dedicated 5S auditor to perform and log weekly inspections.',
    },
    {
      id: 'SUST_002',
      question: '5S board communication',
      benchmark: 'Dashboard or visual boards must show recent performance and open actions.',
      defaultEvidence: {
        good: 'The team 5S communication board displays updated scores and action plans.',
        average: 'The board is present, but scores have not been updated this month.',
        bad: 'No 5S communication board is present in this department.',
      },
      defaultReason: {
        good: 'Daily standups cover outstanding 5S audit scores.',
        average: 'Performance trends are visible, but corrective actions are blank.',
        bad: 'Lack of shared workspace for discussing audit feedback.',
      },
      defaultRecommendation: 'Post the latest audit results on the team board and highlight open recommendations.',
    },
    {
      id: 'SUST_003',
      question: 'Employee training',
      benchmark: 'Operators must understand 5S expectations and maintain their zones.',
      defaultEvidence: {
        good: 'Operators demonstrate thorough knowledge of 5S standards.',
        average: 'Operators are familiar with 5S, but lack detail on standard layouts.',
        bad: 'Operators have not received formal training on 5S procedures.',
      },
      defaultReason: {
        good: 'Onboarding training includes 5S concepts and certifications.',
        average: 'Refreshers are overdue, resulting in slight habit slips.',
        bad: 'No formal training program is established in the workspace.',
      },
      defaultRecommendation: 'Schedule a 5S retraining session for the shift teams.',
    },
    {
      id: 'SUST_004',
      question: 'Closure of past findings',
      benchmark: 'Outstanding audit items must be resolved and signed off.',
      defaultEvidence: {
        good: 'All action items from the previous audit are closed and verified.',
        average: 'Two action items remain open past their target completion date.',
        bad: 'No action items from previous audits have been addressed.',
      },
      defaultReason: {
        good: 'Corrective actions are tracked to completion on a daily log.',
        average: 'Follow-ups are logged, but resource constraints delayed action.',
        bad: 'Findings are filed away without scheduling remediation.',
      },
      defaultRecommendation: 'Review open actions daily during shift handovers to accelerate resolution.',
    },
  ],
};

const scoreToRating = (score: number): 'Very Bad' | 'Bad' | 'Average' | 'Good' | 'Very Good' => {
  if (score >= 4) return 'Very Good';
  if (score === 3) return 'Good';
  if (score === 2) return 'Average';
  if (score === 1) return 'Bad';
  return 'Very Bad';
};

const overallScoreToRating = (percentage: number): 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Poor' => {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 70) return 'Good';
  if (percentage >= 50) return 'Average';
  if (percentage >= 25) return 'Needs Improvement';
  return 'Poor';
};

const getMockRecommendation = (
  priority: 'Immediate' | 'High' | 'Medium' | 'Low',
  pillar: string,
  problem: string,
  action: string,
  benefit: string,
  scoreGain: number,
  linkedQuestionId: string
): FutureAuditRecommendation => {
  return {
    id: `rec_${linkedQuestionId}_${Math.round(Math.random() * 1000)}`,
    priority,
    pillarName: pillar,
    problem,
    recommendation: action,
    expectedBenefit: benefit,
    scoreGain,
    linkedQuestionId,
  };
};

export function mapSessionToAuditResult(
  session: AuditSession & { items?: AuditSessionItem[]; responses?: AuditItemResponse[] }
): FutureAuditResult {
  const items = session.items ?? [];
  const responses = session.responses ?? [];

  const pillarDataMap = new Map<
    AuditPillar,
    Array<{ item: AuditSessionItem; resp?: AuditItemResponse }>
  >();

  AUDIT_PILLARS.forEach((p) => {
    pillarDataMap.set(p, []);
  });

  items.forEach((item) => {
    const resp = responses.find((r) => r.session_item_id === item.id);
    const p = item.pillar;
    if (pillarDataMap.has(p)) {
      pillarDataMap.get(p)!.push({ item, resp });
    }
  });

  const recommendations: FutureAuditRecommendation[] = [];

  const mappedPillars: FuturePillar[] = AUDIT_PILLARS.map((pKey) => {
    const dbList = pillarDataMap.get(pKey) ?? [];
    const meta = PILLAR_META[pKey];
    const stdDefs = STANDARD_5S_QUESTIONS[pKey];

    const mappedQuestions: FutureAuditQuestion[] = stdDefs.map((def, idx) => {
      const dbNode = dbList[idx];

      let score = 4;
      let evidence = def.defaultEvidence.good;
      let reason = def.defaultReason.good;

      if (dbNode) {
        const r = dbNode.resp;
        if (r) {
          if (r.final_score !== null && r.final_score !== undefined) {
            score = Math.min(4, Math.max(0, r.final_score));
          } else if (r.manual_score !== null && r.manual_score !== undefined) {
            score = Math.min(4, Math.max(0, r.manual_score));
          } else if (r.ai_answer) {
            if (r.ai_answer === 'YES') score = 4;
            else if (r.ai_answer === 'PARTIAL') score = 2;
            else if (r.ai_answer === 'NO') score = 0;
            else score = 0;
          }

          evidence = r.evidence || r.observation || (score >= 3 ? def.defaultEvidence.good : score === 2 ? def.defaultEvidence.average : def.defaultEvidence.bad);
          reason = r.reasoning || r.notes || (score >= 3 ? def.defaultReason.good : score === 2 ? def.defaultReason.average : def.defaultReason.bad);
        }
      } else {
        const mockScores = [4, 3, 2, 4];
        score = mockScores[idx % 4];
        evidence = score >= 3 ? def.defaultEvidence.good : score === 2 ? def.defaultEvidence.average : def.defaultEvidence.bad;
        reason = score >= 3 ? def.defaultReason.good : score === 2 ? def.defaultReason.average : def.defaultReason.bad;
      }

      const rating = scoreToRating(score);

      if (score < 4) {
        const priority: 'Immediate' | 'High' | 'Medium' | 'Low' = score === 0 ? 'Immediate' : score === 1 ? 'High' : score === 2 ? 'Medium' : 'Low';
        const problem = `Workstation shows room for improvement in ${def.question.toLowerCase()}.`;
        const gain = 4 - score;
        
        recommendations.push(
          getMockRecommendation(
            priority,
            meta.label,
            problem,
            def.defaultRecommendation,
            `Restores workstation standard for ${def.question.toLowerCase()}.`,
            gain,
            def.id
          )
        );
      }

      return {
        id: def.id,
        question: def.question,
        rating,
        score,
        benchmark: def.benchmark,
        evidence,
        reason,
        supportingObservation: evidence,
      };
    });

    const totalScore = mappedQuestions.reduce((s, q) => s + q.score, 0);
    const maxScore = 16;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rating = scoreToRating(Math.round(totalScore / 4));

    return {
      name: pKey,
      label: meta.label,
      jpName: meta.jp,
      score: totalScore,
      maxScore,
      percentage,
      rating,
      questions: mappedQuestions,
    };
  });

  const overallScore = mappedPillars.reduce((s, p) => s + p.score, 0);
  const overallMaxScore = 80;
  const overallPercentage = Math.round((overallScore / overallMaxScore) * 100);
  const overallRating = overallScoreToRating(overallPercentage);

  const sortedPillars = [...mappedPillars].sort((a, b) => b.score - a.score);
  const highestPillar = sortedPillars[0]?.label ?? 'Sort';
  const lowestPillar = sortedPillars[sortedPillars.length - 1]?.label ?? 'Sustain';

  const strengths = mappedPillars
    .filter((p) => p.percentage >= 80)
    .map((p) => `High compliance in ${p.label} (${p.percentage}%).`);
  if (strengths.length === 0) {
    strengths.push(`Standard maintained in ${highestPillar}.`);
  }

  const weaknesses = mappedPillars
    .filter((p) => p.percentage < 70)
    .map((p) => `Identified cleaning or order issues in ${p.label} (${p.percentage}%).`);
  if (weaknesses.length === 0) {
    weaknesses.push(`Minor opportunities exist to optimize ${lowestPillar}.`);
  }

  const summary: FutureAuditSummary = {
    strengths,
    weaknesses,
    highestPillar,
    lowestPillar,
    totalRecommendations: recommendations.length,
    potentialImprovement: 80 - overallScore,
    // Phase 3A — expanded executive summary
    overallScore,
    overallMaxScore,
    overallPercentage,
    overallRating,
    // criticalFindings is computed from pillar deductions
    criticalFindings: mappedPillars.reduce((sum, p) => {
      const raw = p.questions.filter((q) => q.severity === 'CRITICAL' && q.score === 0).length;
      return sum + raw;
    }, 0),
    imageQualityScore: null, // populated externally by ImageValidationPanel
    imageQualityLevel: null,
    auditConfidence:   null, // populated externally from API result
  };

  return {
    overallScore,
    overallMaxScore,
    overallPercentage,
    overallRating,
    pillars: mappedPillars,
    recommendations: sortRecommendations(recommendations),
    summary,
    areaInfo: {
      companyName: 'ARCOLAB MANUFACTURING LTD',
      auditDate: session.audit_date || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      areaName: session.area_name || 'Production Floor',
      department: session.department_name || 'Manufacturing',
      industry: session.industry || 'General Industrial',
      workspaceType: session.workspace_type || 'Assembly Station',
      auditor: session.auditor_name || 'Authorized Auditor',
    },
  };
}

export function mapAnalysisResultToAuditResult(
  data: AuditAnalysisResult,
  analysisDate?: string
): FutureAuditResult {
  const beforeScore = data.before.score;
  
  const pseudoSession: AuditSession & { items: AuditSessionItem[]; responses: AuditItemResponse[] } = {
    id: 'pseudo-id',
    audit_number: 'AUD-PIPELINE',
    template_id: data.template.id,
    template_name: data.template.name,
    template_version: data.template.version,
    auditor_id: 'pipeline-auditor',
    auditor_name: 'ARCOLAB Vision System',
    area_id: null,
    area_name: 'Workplace Scan',
    department_name: 'Production Operations',
    plant_name: 'Digital Plant',
    analysis_log_id: null,
    audit_date: analysisDate || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    status: 'COMPLETED',
    total_score: beforeScore.overall_score,
    max_score: beforeScore.overall_maximum,
    percentage: beforeScore.overall_percentage,
    notes: 'vision analysis run',
    score_breakdown: null,
    generated_after_image_url: null,
    improvement_prompt: data.improvement_prompt,
    prompt_version_id: data.prompt_version,
    vision_model_used: data.vision_model,
    prompt_schema_version: data.schema_version,
    analysis_mode: 'FULL_AI',
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: beforeScore.pillar_scores.flatMap((ps, pIdx) => {
      const pillarResp = data.before.responses.filter((r) => {
        const itemPillar = r.question_id.split('_')[0];
        const mappedPillar = ps.pillar;
        return itemPillar === mappedPillar || r.question_id.toLowerCase().includes(mappedPillar.toLowerCase().replace('_', ''));
      });

      return pillarResp.map((r, rIdx) => ({
        id: r.question_id,
        audit_session_id: 'pseudo-id',
        original_checklist_item_id: r.question_id,
        pillar: ps.pillar,
        question_id: r.question_id,
        question_text: `Visual verification item ${rIdx + 1}`,
        description: null,
        max_points: 4,
        weight: 1,
        display_order: rIdx,
        is_mandatory: true,
        severity: 'MAJOR',
        category: 'General',
        created_at: new Date().toISOString(),
      }));
    }),
    responses: data.before.responses.map((r) => ({
      id: `resp_${r.question_id}`,
      audit_session_id: 'pseudo-id',
      session_item_id: r.question_id,
      manual_score: null,
      ai_answer: r.ai_answer,
      evidence: r.evidence,
      ai_question_id: r.question_id,
      confidence: r.confidence,
      final_score: r.ai_answer === 'YES' ? 4 : r.ai_answer === 'PARTIAL' ? 2 : 0,
      reasoning: r.evidence,
      observation: r.evidence,
      reviewer_comment: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
  };

  const mapped = mapSessionToAuditResult(pseudoSession);

  if (data.recommendations && data.recommendations.length > 0) {
    const pipelineRecommendations: FutureAuditRecommendation[] = data.recommendations.map((rec, rIdx) => {
      const standardPillar = AUDIT_PILLARS.find(
        (p) => p.toLowerCase().replace('_', '') === rec.pillar.toLowerCase().replace('_', '')
      ) || 'SORT';

      const stdQuestions = STANDARD_5S_QUESTIONS[standardPillar];
      const matchedIdx = rIdx % 4;
      const linkedQuestion = stdQuestions[matchedIdx];

      const priority = rec.severity === 'CRITICAL' ? 'Immediate' : rec.severity === 'MAJOR' ? 'High' : rec.severity === 'MINOR' ? 'Medium' : 'Low';

      return {
        id: `rec_${linkedQuestion.id}_${rIdx}`,
        priority,
        pillarKey:   standardPillar,
        pillarName:  PILLAR_META[standardPillar].label,
        problem:     rec.description || rec.title || 'Workplace layout could be optimized.',
        recommendation: rec.corrective_action || rec.title,
        expectedBenefit: rec.expected_benefit || rec.root_cause || 'Restores safety and efficiency standards.',
        scoreGain:   rec.priority || 2,
        linkedQuestionId: linkedQuestion.id,
      };
    });

    mapped.recommendations = sortRecommendations(pipelineRecommendations);
    mapped.summary.totalRecommendations = mapped.recommendations.length;
  }

  // Inject audit_confidence from the API response into the summary
  if (typeof data.audit_confidence === 'number') {
    mapped.summary.auditConfidence = Math.round(data.audit_confidence * 100);
  }

  return mapped;
}

// ── Recommendation sort utility ───────────────────────────────────────────────

const PRIORITY_SORT_ORDER: Record<string, number> = {
  Immediate: 0,
  High:      1,
  Medium:    2,
  Low:       3,
};

/**
 * Sorts recommendations by:
 *   1. Priority   — Immediate → High → Medium → Low
 *   2. Score gain — highest potential improvement first
 *   3. Pillar     — SORT → SET_IN_ORDER → SHINE → STANDARDIZE → SUSTAIN
 */
export function sortRecommendations(
  recs: FutureAuditRecommendation[]
): FutureAuditRecommendation[] {
  return [...recs].sort((a, b) => {
    const pDiff = (PRIORITY_SORT_ORDER[a.priority] ?? 4) - (PRIORITY_SORT_ORDER[b.priority] ?? 4);
    if (pDiff !== 0) return pDiff;
    const sDiff = b.scoreGain - a.scoreGain;
    if (sDiff !== 0) return sDiff;
    const aIdx = AUDIT_PILLARS.indexOf((a.pillarKey || 'SORT') as AuditPillar);
    const bIdx = AUDIT_PILLARS.indexOf((b.pillarKey || 'SORT') as AuditPillar);
    return aIdx - bIdx;
  });
}

