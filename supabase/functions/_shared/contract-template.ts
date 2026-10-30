import type { ContractKind, ContractPromptInput } from './prompts.ts';

/**
 * Deterministic contract rendering. Replaces per-contract model generation:
 * a residential work agreement should be the same reviewed text every time,
 * with the job's specifics merged in. Instant, free, and auditable.
 *
 * LEGAL REVIEW: the clause wording below is plain-English boilerplate drafted
 * for this app and has NOT yet been reviewed by an attorney. PRD §8 calls for
 * per-state legal review; when that happens, the reviewed text replaces these
 * strings and nothing else in the pipeline changes. Do not add state law
 * citations here beyond what review approves.
 */

export type ContractTemplateInput = ContractPromptInput & {
  /** ISO date the contract is generated; rendered as the agreement date. */
  generated_at?: string;
};

type StateClauses = {
  /** Clause under "Cancellation". */
  cancellation?: string;
  /** Additional notices appended as their own section. */
  notices?: string[];
};

const THREE_DAY_CANCEL =
  'You may cancel this agreement for any reason within 3 business days after signing by ' +
  'telling the Contractor in writing (text message or email is fine). Any deposit will be ' +
  'returned within 10 business days of cancellation.';

const STATE_CLAUSES: Record<string, StateClauses> = {
  TX: {
    notices: [
      '**Lien notice.** For work over $250, Texas law may give the Contractor and any unpaid ' +
        'subcontractors or suppliers a right to file a lien on the property if they are not paid.',
      '**Permits.** Gas, electrical and plumbing work may require a permit from the local ' +
        'authority. The Contractor will tell you before starting any work that needs one.',
    ],
  },
  CA: {
    cancellation: THREE_DAY_CANCEL,
    notices: [
      '**Licensing.** In California, work valued at $500 or more (labor and materials) must be ' +
        'performed by a contractor licensed by the Contractors State License Board.',
    ],
  },
  FL: {
    cancellation: THREE_DAY_CANCEL,
    notices: [
      '**Lien notice.** Under Florida law, anyone who provides labor or materials for this ' +
        'work and is not paid may have a right to a lien on the property.',
    ],
  },
  NY: {
    cancellation: THREE_DAY_CANCEL,
    notices: [
      '**Home improvement contract.** For work over $500, New York requires this agreement to ' +
        'state an itemized price and approximate start and completion dates, which appear above.',
    ],
  },
  NC: {
    notices: [
      '**Licensing.** In North Carolina, projects of $30,000 or more must be performed by a ' +
        'licensed general contractor.',
    ],
  },
};

function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function longDate(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function customerLine(input: ContractTemplateInput): string {
  const loc = [input.customer.address_line1, input.customer.city, input.customer.state_code]
    .filter(Boolean)
    .join(', ');
  return loc ? `${input.customer.name}, ${loc}` : input.customer.name;
}

function lineItemsTable(input: ContractTemplateInput): string[] {
  const rows = ['| Item | Qty | Unit price | Total |', '| --- | ---: | ---: | ---: |'];
  for (const item of input.quote.line_items) {
    rows.push(
      `| ${item.label} | ${item.qty} | ${money(item.unit_price_cents)} | ${money(item.total_cents)} |`,
    );
  }
  rows.push(`| **Total** | | | **${money(input.quote.total_cents)}** |`);
  return rows;
}

function signatureBlocks(input: ContractTemplateInput): string[] {
  return [
    '## Signatures',
    '',
    'By signing, each party agrees to everything in this document.',
    '',
    `**Contractor:** ${input.contractor.business_name}`,
    '',
    'Signature: ____________________________  Date: ______________',
    '',
    `**Customer:** ${input.customer.name}`,
    '',
    'Signature: ____________________________  Date: ______________',
  ];
}

export function renderWorkAgreement(input: ContractTemplateInput): string {
  const state = input.state_code.toUpperCase();
  const clauses = STATE_CLAUSES[state] ?? {};
  const out: string[] = [];

  out.push('# Work Agreement');
  out.push('');
  out.push(
    `This agreement is made on ${longDate(input.generated_at)} between ` +
      `**${input.contractor.business_name}** (the "Contractor") and ` +
      `**${customerLine(input)}** (the "Customer") for work in the state of ${state}.`,
  );
  out.push('');
  out.push('## Scope of Work');
  out.push('');
  out.push(input.quote.scope_of_work.trim());
  out.push('');
  out.push(
    'Anything not listed above is not included. If the Customer asks for extra work, or the ' +
      'Contractor finds a hidden condition that changes the job, both parties will agree on the ' +
      'change and the price in writing before that work starts (a "change order").',
  );
  out.push('');
  out.push('## Price and Payment');
  out.push('');
  out.push(...lineItemsTable(input));
  out.push('');
  out.push(
    'Prices include labor and materials as listed. Any applicable sales tax is shown in the ' +
      'total. Payment is due when the work is complete unless the parties agree to a deposit or ' +
      'schedule in writing. The Contractor will provide an invoice.',
  );
  out.push('');
  out.push('## Timeline');
  out.push('');
  out.push(
    'Work will be scheduled with the Customer and is expected to start on the scheduled date ' +
      'and be completed in the time the Contractor estimates at scheduling. Weather, material ' +
      'availability, and hidden conditions can change this. The Contractor will keep the ' +
      'Customer informed of any delay.',
  );
  out.push('');
  out.push('## Warranty');
  out.push('');
  out.push(
    'The Contractor warrants its workmanship for one year from completion and will fix defects ' +
      'in its own work at no charge during that time. Materials are covered by the manufacturer’s ' +
      'warranty, if any. This warranty does not cover normal wear, misuse, or work by others.',
  );
  out.push('');
  out.push('## Cancellation');
  out.push('');
  out.push(
    clauses.cancellation ??
      'Either party may cancel before work begins by telling the other in writing. If the ' +
        'Customer cancels after materials have been purchased for this job, the Customer agrees to ' +
        'pay for those materials.',
  );
  if (clauses.notices && clauses.notices.length > 0) {
    out.push('');
    out.push(`## ${stateName(state)} Notices`);
    out.push('');
    for (const n of clauses.notices) {
      out.push(n);
      out.push('');
    }
    out.pop();
  }
  out.push('');
  out.push('## General');
  out.push('');
  out.push(
    'This is the whole agreement between the parties for this job. Changes must be in writing. ' +
      `This agreement is governed by the laws of the state of ${state}.`,
  );
  out.push('');
  out.push(...signatureBlocks(input));
  return out.join('\n');
}

export function renderReleaseOfLiability(input: ContractTemplateInput): string {
  const state = input.state_code.toUpperCase();
  const out: string[] = [];
  out.push('# Release of Liability');
  out.push('');
  out.push(
    `On ${longDate(input.generated_at)}, **${customerLine(input)}** (the "Customer") asked ` +
      `**${input.contractor.business_name}** (the "Contractor") to perform the following work ` +
      `in the state of ${state}:`,
  );
  out.push('');
  out.push(input.quote.scope_of_work.trim());
  out.push('');
  out.push('## Acknowledgment');
  out.push('');
  out.push(
    'The Customer understands that this work carries ordinary risks to the property, including ' +
      'damage to finishes, fixtures, landscaping, or items left in the work area, and that ' +
      'existing conditions the Contractor did not create may be discovered or made worse by the work.',
  );
  out.push('');
  out.push('## Release');
  out.push('');
  out.push(
    'In exchange for the Contractor performing this work, the Customer releases the Contractor ' +
      'from claims for loss or damage arising from the work, except for loss or damage caused by ' +
      'the Contractor’s negligence or intentional misconduct. Nothing here waives rights that ' +
      `cannot be waived under the laws of the state of ${state}.`,
  );
  out.push('');
  out.push('## Customer Responsibilities');
  out.push('');
  out.push(
    'The Customer will clear the work area of personal items, tell the Contractor about known ' +
      'hazards or hidden lines, and keep children and pets away from the work area while work is ' +
      'in progress.',
  );
  out.push('');
  out.push(...signatureBlocks(input));
  return out.join('\n');
}

/**
 * Body for an amended version of a signed contract (CLAUDE.md §3.6: signed
 * contracts are write-once; amendments are new versions). Starts from the
 * signed text with a note on top that the contractor edits before sending.
 * A previous amendment note is replaced rather than stacked.
 */
export function amendmentBody(
  signedBody: string,
  newVersion: number,
  originalSignedAt: string,
): string {
  const withoutOldNote = signedBody.replace(/^> \*\*Amendment \d+\*\*[^\n]*\n\n/, '');
  const note =
    `> **Amendment ${newVersion - 1}** to the agreement signed ${longDate(originalSignedAt)}. ` +
    'Once signed, this version replaces the earlier one. Changes are described below.';
  return `${note}\n\n${withoutOldNote}`;
}

export function renderContract(kind: ContractKind, input: ContractTemplateInput): string {
  return kind === 'release' ? renderReleaseOfLiability(input) : renderWorkAgreement(input);
}

const STATE_NAMES: Record<string, string> = {
  TX: 'Texas',
  CA: 'California',
  FL: 'Florida',
  NY: 'New York',
  NC: 'North Carolina',
};

function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}
