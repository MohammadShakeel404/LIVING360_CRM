import { PrismaClient, RoleName, LeadSource, LeadStage, LeadScore, FollowUpType, TaskPriority, TaskStatus, ProjectStage } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Living360Demo!"; // change immediately in a real deployment

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = await Promise.all(
    [
      { name: "Priya Deshmukh", email: "superadmin@living360.in", role: RoleName.SUPER_ADMIN },
      { name: "Rohan Mehta", email: "admin@living360.in", role: RoleName.ADMIN },
      { name: "Vikram Nair", email: "vikram@living360.in", role: RoleName.SALES_MANAGER },
      { name: "Ritu Shah", email: "ritu@living360.in", role: RoleName.SALES_EXECUTIVE },
      { name: "Ayesha Khan", email: "ayesha@living360.in", role: RoleName.INTERIOR_DESIGNER },
      { name: "Farhan Iqbal", email: "farhan@living360.in", role: RoleName.PROJECT_MANAGER },
      { name: "Sunil Gowda", email: "sunil@living360.in", role: RoleName.SITE_SUPERVISOR },
      { name: "Meenal Joshi", email: "meenal@living360.in", role: RoleName.ACCOUNTANT },
    ].map((u) => prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } }))
  );

  const [, , salesManager, salesExec, , projectManager] = users;

  const leadSeed = [
    { name: "Meera Pillai", phone: "+919845012233", source: LeadSource.INSTAGRAM, stage: LeadStage.NEW_LEAD, score: LeadScore.HOT, propertyType: "3 BHK Apartment", projectLocation: "Whitefield, Bengaluru", budgetMin: 1800000, budgetMax: 2200000, assignedToId: salesExec.id },
    { name: "Arvind Rao", phone: "+919900144521", source: LeadSource.REFERRAL, stage: LeadStage.CONTACTED, score: LeadScore.WARM, propertyType: "2 BHK Apartment", projectLocation: "Indiranagar, Bengaluru", budgetMin: 1200000, budgetMax: 1500000, assignedToId: salesExec.id },
    { name: "Nikhil Kapoor", phone: "+919880722190", source: LeadSource.WEBSITE, stage: LeadStage.REQUIREMENT_DISCUSSED, score: LeadScore.HOT, propertyType: "4 BHK Villa", projectLocation: "Sarjapur Road", budgetMin: 3000000, budgetMax: 3500000, assignedToId: salesManager.id },
    { name: "Deepak Menon", phone: "+919740388120", source: LeadSource.GOOGLE, stage: LeadStage.SITE_VISIT_SCHEDULED, score: LeadScore.WARM, propertyType: "1 BHK Apartment", projectLocation: "HSR Layout", budgetMin: 800000, budgetMax: 1000000, assignedToId: salesExec.id, nextFollowUpAt: daysFromNow(-1) },
    { name: "Fatima Sheikh", phone: "+919663321987", source: LeadSource.FACEBOOK_ADS, stage: LeadStage.QUOTATION_SENT, score: LeadScore.HOT, propertyType: "3 BHK Apartment", projectLocation: "Koramangala", budgetMin: 2500000, budgetMax: 2800000, assignedToId: salesManager.id, nextFollowUpAt: daysFromNow(-3) },
    { name: "Karthik Subramaniam", phone: "+919986234410", source: LeadSource.INSTAGRAM, stage: LeadStage.CONVERTED, score: LeadScore.HOT, propertyType: "3 BHK Villa", projectLocation: "Yelahanka", budgetMin: 3200000, budgetMax: 3200000, assignedToId: salesManager.id },
  ];

  const createdLeads = [];
  for (let i = 0; i < leadSeed.length; i++) {
    const l = leadSeed[i];
    const lead = await prisma.lead.create({
      data: {
        leadNumber: `LD-${1000 + i + 1}`,
        name: l.name, phone: l.phone, source: l.source, stage: l.stage, score: l.score,
        propertyType: l.propertyType, projectLocation: l.projectLocation,
        budgetMin: l.budgetMin, budgetMax: l.budgetMax,
        assignedToId: l.assignedToId, nextFollowUpAt: l.nextFollowUpAt ?? daysFromNow(1),
      },
    });
    createdLeads.push(lead);

    await prisma.followUp.create({
      data: {
        leadId: lead.id, type: FollowUpType.CALL, scheduledAt: lead.nextFollowUpAt!,
        createdById: l.assignedToId,
      },
    });
  }

  // Convert the last lead into a client + project
  const convertedLead = createdLeads[createdLeads.length - 1];
  const client = await prisma.client.create({
    data: {
      clientNumber: "CL-1001", leadId: convertedLead.id, name: convertedLead.name, phone: convertedLead.phone,
    },
  });

  const project = await prisma.project.create({
    data: {
      projectNumber: "PRJ-1001", clientId: client.id, projectManagerId: projectManager.id,
      siteLocation: "Yelahanka, Bengaluru", stage: ProjectStage.EXECUTION,
      budget: 3200000, value: 3200000, startDate: daysFromNow(-45), expectedCompletion: daysFromNow(30),
    },
  });

  await prisma.task.createMany({
    data: [
      { projectId: project.id, title: "Finalize modular kitchen BOQ", assigneeId: projectManager.id, priority: TaskPriority.HIGH, status: TaskStatus.IN_PROGRESS, dueDate: daysFromNow(1) },
      { projectId: project.id, title: "Site measurement — false ceiling", assigneeId: projectManager.id, priority: TaskPriority.URGENT, status: TaskStatus.TODO, dueDate: daysFromNow(0) },
    ],
  });

  // Letterhead / document defaults — edit these in Settings.
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Living 360",
      tagline: "Interior Design & Execution",
      quotationTerms: "50% advance to confirm the order.\n40% on delivery of materials to site, 10% on handover.\nPrices are valid until the date shown above.\nAny work outside this scope will be quoted separately.",
      invoiceTerms: "Payment due by the date shown above.\nPlease quote the invoice number with your payment.",
    },
  });

  console.log(`Seeded ${users.length} users, ${createdLeads.length} leads, 1 client/project.`);
  console.log(`Demo login: superadmin@living360.in / ${DEMO_PASSWORD}`);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
