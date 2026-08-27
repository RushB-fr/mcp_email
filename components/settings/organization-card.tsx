"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, UserPlus, Pencil, ArrowRightLeft, Inbox, KeyRound, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Rows, Row, RowMain, RowActions } from "@/components/ui/list-row";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  createOrganization,
  inviteOrganizationMember,
  removeOrganizationMember,
  transferOrganizationOwnership,
  cancelOrganizationInvite,
  shareMailboxToOrganization,
  unshareMailboxFromOrganization,
  createMailboxGroup,
  renameMailboxGroup,
  deleteMailboxGroup,
  addMailboxToGroup,
  removeMailboxFromGroup,
  grantMailboxAccess,
  grantMailboxGroupAccess,
  revokeMailboxGrant,
  type GrantTarget,
} from "@/lib/actions/organization";
import type { Dictionary } from "@/lib/i18n/locale";

type OrgCardDict = {
  common: Pick<Dictionary["common"], "cancel" | "create" | "add" | "share" | "save">;
  organizations: Dictionary["settings"]["organizations"];
};

export type OrgDetail = {
  id: string;
  name: string;
  myRole: "OWNER" | "MEMBER";
  /** The caller's own OrganizationMember id in this org - identifies its own row in `members` below. */
  myMemberId: string;
  members: { id: string; userId: string; email: string; role: "OWNER" | "MEMBER" }[];
  mailboxes: { organizationMailboxId: string; mailboxId: string; email: string; ownerEmail: string }[];
  groups: { id: string; name: string; mailboxes: { organizationMailboxId: string; mailboxId: string; email: string }[] }[];
  pendingInvites: { id: string; email: string; expiresAt: string }[];
  grants: {
    id: string;
    targetKind: "member" | "invite";
    targetId: string;
    targetEmail: string;
    /** True when this grant targets a still-pending invite rather than an enrolled member. */
    pending: boolean;
    mailboxEmail: string | null;
    mailboxGroupName: string | null;
    mailboxGroupMailboxes: string[];
  }[];
};

/** Small dashed-border empty state, matching design-proposal-v2.html's `.empty`. */
function EmptyRow({ icon: Icon, children }: { icon: typeof Inbox; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-input p-3 text-sm text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" /> {children}
    </div>
  );
}

function BlockTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-2.5 text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}>
      {children}
    </p>
  );
}

export function OrganizationCard({
  ownMailboxes,
  organizations,
  dict,
}: {
  ownMailboxes: { id: string; email: string }[];
  organizations: OrgDetail[];
  dict: OrgCardDict;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {dict.organizations.intro.part1} <code className="text-xs">OWNER</code> {dict.organizations.intro.part2}{" "}
        <code className="text-xs">MEMBER</code> {dict.organizations.intro.part3}
      </p>

      {organizations.map((org) => (
        <OrganizationSection key={org.id} org={org} ownMailboxes={ownMailboxes} dict={dict} />
      ))}

      {creating ? (
        <CreateOrganizationForm onDone={() => setCreating(false)} dict={dict} />
      ) : (
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> {dict.organizations.createButton}
        </Button>
      )}
    </div>
  );
}

function CreateOrganizationForm({ onDone, dict }: { onDone: () => void; dict: OrgCardDict }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createOrganization({ name });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Input
        placeholder={dict.organizations.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleCreate} disabled={pending || !name.trim()}>
          {dict.common.create}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {dict.common.cancel}
        </Button>
      </div>
    </div>
  );
}

function OrganizationSection({
  org,
  ownMailboxes,
  dict,
}: {
  org: OrgDetail;
  ownMailboxes: { id: string; email: string }[];
  dict: OrgCardDict;
}) {
  const isOwner = org.myRole === "OWNER";
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [shareMailboxId, setShareMailboxId] = useState(ownMailboxes[0]?.id ?? "");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");

  const nonOwnerMembers = org.members.filter((m) => m.role === "MEMBER");
  const ownerCount = org.members.filter((m) => m.role === "OWNER").length;

  const [transferTargetId, setTransferTargetId] = useState(nonOwnerMembers[0]?.id ?? "");
  const [transferError, setTransferError] = useState<string | null>(null);
  // Same staleness concern as elsewhere in this file: the member list can
  // change without this component remounting.
  const effectiveTransferTargetId = nonOwnerMembers.some((m) => m.id === transferTargetId)
    ? transferTargetId
    : nonOwnerMembers[0]?.id ?? "";

  function handleInvite() {
    setInviteError(null);
    startTransition(async () => {
      const result = await inviteOrganizationMember({ organizationId: org.id, email: inviteEmail });
      if (result.error) setInviteError(result.error);
      else setInviteEmail("");
    });
  }

  function handleRemoveMember(memberId: string) {
    if (!window.confirm(dict.organizations.confirmRemoveMember)) return;
    startTransition(() => {
      void removeOrganizationMember(memberId);
    });
  }

  function handleTransferOwnership() {
    const target = nonOwnerMembers.find((m) => m.id === effectiveTransferTargetId);
    if (!target) return;
    const confirmMessage = `${dict.organizations.confirmTransferOwnershipPrefix}${target.email}${dict.organizations.confirmTransferOwnershipSuffix}`;
    if (!window.confirm(confirmMessage)) return;
    setTransferError(null);
    startTransition(async () => {
      const result = await transferOrganizationOwnership(org.id, target.id);
      if (result.error) setTransferError(result.error);
    });
  }

  function handleCancelInvite(inviteId: string) {
    if (!window.confirm(dict.organizations.confirmCancelInvite)) return;
    startTransition(() => {
      void cancelOrganizationInvite(inviteId);
    });
  }

  function handleShare() {
    if (!shareMailboxId) return;
    setShareMessage(null);
    startTransition(async () => {
      const result = await shareMailboxToOrganization(org.id, shareMailboxId);
      setShareMessage(result.error ?? dict.organizations.shareSuccess);
    });
  }

  function handleUnshare(mailboxId: string) {
    if (!window.confirm(dict.organizations.confirmUnshare)) return;
    startTransition(() => {
      void unshareMailboxFromOrganization(org.id, mailboxId);
    });
  }

  function handleCreateGroup() {
    if (!groupName.trim()) return;
    startTransition(async () => {
      await createMailboxGroup({ organizationId: org.id, name: groupName });
      setGroupName("");
    });
  }

  return (
    <div className="rounded-lg border border-border p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="font-semibold">{org.name}</span>
        <Badge variant={isOwner ? "success" : "outline"}>{org.myRole}</Badge>
      </div>

      <div className="space-y-6">
        {/* Members */}
        <div>
          <BlockTitle>{dict.organizations.membersTitle}</BlockTitle>
          <Rows>
            {org.members.map((m) => {
              const isSelf = m.id === org.myMemberId;
              const isLastOwner = isSelf && m.role === "OWNER" && ownerCount <= 1;
              return (
                <Row key={m.id}>
                  <RowMain>
                    <span className="truncate text-sm">{m.email}</span>
                    <Badge variant={m.role === "OWNER" ? "success" : "outline"}>{m.role}</Badge>
                    {isLastOwner && <Badge variant="warning">{dict.organizations.lastOwnerBadge}</Badge>}
                  </RowMain>
                  {isOwner && (
                    <RowActions>
                      <Button
                        type="button"
                        variant="destructive-ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={pending || isLastOwner}
                        title={isLastOwner ? dict.organizations.lastOwnerRemoveTooltip : undefined}
                        aria-label={dict.organizations.confirmRemoveMember}
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </Button>
                    </RowActions>
                  )}
                </Row>
              );
            })}
            {isOwner &&
              org.pendingInvites.map((i) => (
                <Row key={i.id}>
                  <RowMain>
                    <span className="truncate text-sm text-muted-foreground">{i.email}</span>
                    <Badge variant="neutral">{dict.organizations.pendingBadge}</Badge>
                  </RowMain>
                  <RowActions>
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="icon-sm"
                      onClick={() => handleCancelInvite(i.id)}
                      disabled={pending}
                      title={dict.organizations.confirmCancelInvite}
                    >
                      <X className="h-[15px] w-[15px]" />
                    </Button>
                  </RowActions>
                </Row>
              ))}
          </Rows>

          {isOwner && nonOwnerMembers.length > 0 && (
            <div className="mt-3 space-y-2 rounded-lg border border-dashed border-input p-2.5">
              <p className="text-xs font-medium text-muted-foreground">{dict.organizations.transferOwnershipTitle}</p>
              <div className="flex gap-2">
                <Select value={effectiveTransferTargetId} onValueChange={setTransferTargetId}>
                  <SelectTrigger className="h-8 flex-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nonOwnerMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={handleTransferOwnership} disabled={pending}>
                  <ArrowRightLeft className="h-3.5 w-3.5" /> {dict.organizations.transferButton}
                </Button>
              </div>
              {transferError && <p className="text-sm text-destructive">{transferError}</p>}
            </div>
          )}

          {isOwner && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={dict.organizations.emailPlaceholder}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button type="button" size="sm" onClick={handleInvite} disabled={pending || !inviteEmail.trim()}>
                  <UserPlus className="h-4 w-4" /> {dict.organizations.inviteButton}
                </Button>
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            </div>
          )}
        </div>

        {/* What the current user can actually reach in this org */}
        {isOwner ? (
          <p className="text-sm text-muted-foreground">{dict.organizations.ownerNotice}</p>
        ) : (
          <div>
            <BlockTitle>{dict.organizations.yourAccessTitle}</BlockTitle>
            {org.grants.length === 0 ? (
              <EmptyRow icon={KeyRound}>{dict.organizations.noAccessYet}</EmptyRow>
            ) : (
              <Rows>
                {org.grants.map((g) => (
                  <Row key={g.id}>
                    <RowMain>
                      <span className="text-sm">
                        {g.mailboxEmail ? (
                          g.mailboxEmail
                        ) : (
                          <>
                            {dict.organizations.groupLabelPrefix}
                            {g.mailboxGroupName}
                            {dict.organizations.groupLabelSuffix}
                            {g.mailboxGroupMailboxes.length > 0 ? (
                              <span className="text-muted-foreground"> · {g.mailboxGroupMailboxes.join(", ")}</span>
                            ) : (
                              <span className="text-muted-foreground"> · {dict.organizations.groupEmpty}</span>
                            )}
                          </>
                        )}
                      </span>
                    </RowMain>
                  </Row>
                ))}
              </Rows>
            )}
          </div>
        )}

        {/* Shared mailboxes */}
        <div>
          <BlockTitle>{dict.organizations.sharedMailboxesTitle}</BlockTitle>
          {org.mailboxes.length === 0 ? (
            <EmptyRow icon={Inbox}>{dict.organizations.noSharedMailboxes}</EmptyRow>
          ) : (
            <Rows>
              {org.mailboxes.map((mb) => (
                <Row key={mb.organizationMailboxId}>
                  <RowMain>
                    <span className="truncate text-sm">{mb.email}</span>
                    <span className="text-sm text-muted-foreground">
                      · {dict.organizations.ownerLabel} {mb.ownerEmail}
                    </span>
                  </RowMain>
                  <RowActions>
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="icon-sm"
                      onClick={() => handleUnshare(mb.mailboxId)}
                      disabled={pending}
                      title={dict.organizations.confirmUnshare}
                    >
                      <Trash2 className="h-[15px] w-[15px]" />
                    </Button>
                  </RowActions>
                </Row>
              ))}
            </Rows>
          )}
          {ownMailboxes.length > 0 && (
            <div className="mt-3 flex gap-2">
              <Select value={shareMailboxId} onValueChange={setShareMailboxId}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownMailboxes.map((mb) => (
                    <SelectItem key={mb.id} value={mb.id}>
                      {mb.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={pending}>
                {dict.common.share}
              </Button>
            </div>
          )}
          {shareMessage && <p className="mt-2 text-sm text-muted-foreground">{shareMessage}</p>}
        </div>

        {isOwner && (
          <>
            {/* Groups */}
            <div>
              <BlockTitle>{dict.organizations.groupsTitle}</BlockTitle>
              {org.groups.length === 0 ? (
                <EmptyRow icon={FolderOpen}>{dict.organizations.noGroups}</EmptyRow>
              ) : (
                <Rows>
                  {org.groups.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
                      orgMailboxes={org.mailboxes}
                      pending={pending}
                      startTransition={startTransition}
                      dict={dict}
                    />
                  ))}
                </Rows>
              )}
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder={dict.organizations.groupNamePlaceholder}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleCreateGroup} disabled={pending || !groupName.trim()}>
                  {dict.common.create}
                </Button>
              </div>
            </div>

            {/* Grants - target a member or a still-pending invite, indifferently */}
            <div>
              <BlockTitle>{dict.organizations.grantsTitle}</BlockTitle>
              {org.grants.length === 0 ? (
                <EmptyRow icon={KeyRound}>{dict.organizations.noGrants}</EmptyRow>
              ) : (
                <Rows>
                  {org.grants.map((g) => (
                    <Row key={g.id}>
                      <RowMain>
                        <span className="flex flex-wrap items-center gap-1.5 text-sm">
                          {g.targetEmail}
                          {g.pending && <Badge variant="neutral">{dict.organizations.pendingBadge}</Badge>}
                          <span className="text-muted-foreground">
                            →{" "}
                            {g.mailboxEmail ??
                              `${dict.organizations.groupRefPrefix}${g.mailboxGroupName}${dict.organizations.groupRefSuffix}`}
                          </span>
                        </span>
                      </RowMain>
                      <RowActions>
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="icon-sm"
                          onClick={() =>
                            startTransition(() => {
                              void revokeMailboxGrant(g.id);
                            })
                          }
                          disabled={pending}
                        >
                          <Trash2 className="h-[15px] w-[15px]" />
                        </Button>
                      </RowActions>
                    </Row>
                  ))}
                </Rows>
              )}
              {(nonOwnerMembers.length > 0 || org.pendingInvites.length > 0) && (
                <div className="mt-3">
                  <GrantForm
                    members={nonOwnerMembers}
                    pendingInvites={org.pendingInvites}
                    mailboxes={org.mailboxes}
                    groups={org.groups}
                    pending={pending}
                    startTransition={startTransition}
                    dict={dict}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  orgMailboxes,
  pending,
  startTransition,
  dict,
}: {
  group: OrgDetail["groups"][number];
  orgMailboxes: OrgDetail["mailboxes"];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  dict: OrgCardDict;
}) {
  const inGroupIds = new Set(group.mailboxes.map((m) => m.organizationMailboxId));
  const available = orgMailboxes.filter((mb) => !inGroupIds.has(mb.organizationMailboxId));
  const [selected, setSelected] = useState(available[0]?.organizationMailboxId ?? "");
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [renameError, setRenameError] = useState<string | null>(null);

  // `available` shrinks/grows as mailboxes are added to/removed from the
  // group (server round-trip via revalidatePath); this component isn't
  // remounted when that happens, so `selected` can end up pointing at an
  // id that's no longer in `available`. Derive the effective value at
  // render time instead of an effect - matches React's guidance for
  // clamping state derived from changing props.
  const effectiveSelected = available.some((mb) => mb.organizationMailboxId === selected)
    ? selected
    : available[0]?.organizationMailboxId ?? "";

  function handleStartRename() {
    setName(group.name);
    setRenameError(null);
    setRenaming(true);
  }

  function handleCancelRename() {
    setRenaming(false);
    setRenameError(null);
    setName(group.name);
  }

  function handleSaveRename() {
    if (!name.trim()) return;
    setRenameError(null);
    startTransition(async () => {
      const result = await renameMailboxGroup(group.id, name);
      if (result.error) setRenameError(result.error);
      else setRenaming(false);
    });
  }

  function handleDeleteGroup() {
    if (!window.confirm(dict.organizations.confirmDeleteGroup)) return;
    startTransition(() => {
      void deleteMailboxGroup(group.id);
    });
  }

  return (
    <div>
      <Row>
        <RowMain>
          {renaming ? (
            <div className="flex flex-1 items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1 text-sm" autoFocus />
              <Button type="button" size="sm" onClick={handleSaveRename} disabled={pending || !name.trim()}>
                {dict.common.save}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelRename} disabled={pending}>
                {dict.common.cancel}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-2 text-left text-sm"
            >
              <span className="font-medium">{group.name}</span>
              <span className="text-muted-foreground">{group.mailboxes.length}</span>
            </button>
          )}
        </RowMain>
        {!renaming && (
          <RowActions>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleStartRename}
              disabled={pending}
              title={dict.organizations.renameGroupTooltip}
            >
              <Pencil className="h-[14px] w-[14px]" />
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon-sm"
              onClick={handleDeleteGroup}
              disabled={pending}
              title={dict.organizations.deleteGroupTooltip}
            >
              <Trash2 className="h-[15px] w-[15px]" />
            </Button>
          </RowActions>
        )}
      </Row>
      {renameError && <p className="mt-1 text-sm text-destructive">{renameError}</p>}
      {expanded && !renaming && (
        <div className="mb-3 space-y-2 rounded-lg bg-muted/40 p-3">
          {group.mailboxes.length > 0 && (
            <ul className="space-y-1">
              {group.mailboxes.map((mb) => (
                <li key={mb.organizationMailboxId} className="flex items-center justify-between text-sm text-muted-foreground">
                  {mb.email}
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    size="icon-sm"
                    onClick={() =>
                      startTransition(() => {
                        void removeMailboxFromGroup(group.id, mb.organizationMailboxId);
                      })
                    }
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <div className="flex gap-2">
              <Select value={effectiveSelected} onValueChange={setSelected}>
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((mb) => (
                    <SelectItem key={mb.organizationMailboxId} value={mb.organizationMailboxId}>
                      {mb.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  startTransition(() => {
                    void addMailboxToGroup(group.id, effectiveSelected);
                  })
                }
                disabled={pending}
              >
                {dict.common.add}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrantForm({
  members,
  pendingInvites,
  mailboxes,
  groups,
  pending,
  startTransition,
  dict,
}: {
  members: OrgDetail["members"];
  pendingInvites: OrgDetail["pendingInvites"];
  mailboxes: OrgDetail["mailboxes"];
  groups: OrgDetail["groups"];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  dict: OrgCardDict;
}) {
  // Recipients are members and still-pending invites indifferently - an
  // owner can set up an invitee's access before they've ever signed up
  // (see the "en attente" badge on the resulting grant).
  const recipients = [
    ...members.map((m) => ({ value: `member:${m.id}`, label: m.email })),
    ...pendingInvites.map((i) => ({
      value: `invite:${i.id}`,
      label: `${i.email} ${dict.organizations.pendingSuffix}`,
    })),
  ];
  const [recipient, setRecipient] = useState(recipients[0]?.value ?? "");
  const [target, setTarget] = useState<string>(mailboxes[0] ? `mailbox:${mailboxes[0].mailboxId}` : groups[0] ? `group:${groups[0].id}` : "");

  const options = [
    ...mailboxes.map((mb) => ({
      value: `mailbox:${mb.mailboxId}`,
      label: `${dict.organizations.mailboxOptionPrefix} : ${mb.email}`,
    })),
    ...groups.map((g) => ({
      value: `group:${g.id}`,
      label: `${dict.organizations.groupOptionPrefix} : ${g.name}`,
    })),
  ];

  // Same staleness issue as GroupRow above: recipients/options can shrink or
  // grow (a member removed, an invite cancelled/accepted, a mailbox
  // unshared, a group deleted) without this component remounting - derive
  // the effective value at render time rather than an effect (React's own
  // guidance for clamping state derived from changing props).
  const effectiveRecipient = recipients.some((r) => r.value === recipient) ? recipient : recipients[0]?.value ?? "";
  const effectiveTarget = options.some((o) => o.value === target) ? target : options[0]?.value ?? "";

  function handleGrant() {
    if (!effectiveRecipient || !effectiveTarget) return;
    const [recipientKind, recipientId] = effectiveRecipient.split(":");
    const [resourceKind, resourceId] = effectiveTarget.split(":");
    const grantTarget: GrantTarget = { kind: recipientKind === "member" ? "member" : "invite", id: recipientId };
    startTransition(() => {
      void (resourceKind === "mailbox"
        ? grantMailboxAccess(grantTarget, resourceId)
        : grantMailboxGroupAccess(grantTarget, resourceId));
    });
  }

  if (options.length === 0 || recipients.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={effectiveRecipient} onValueChange={setRecipient}>
        <SelectTrigger className="w-auto min-w-[10rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {recipients.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={effectiveTarget} onValueChange={setTarget}>
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="sm" onClick={handleGrant} disabled={pending}>
        {dict.organizations.grantButton}
      </Button>
    </div>
  );
}
