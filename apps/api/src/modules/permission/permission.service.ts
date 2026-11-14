import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';

export interface PermissionEntry {
  id: string;
  groupName: string;
  serviceName: string;
  permissionKey: string;
  label: string;
  description: string | null;
}

export interface PermissionGroup {
  groupName: string;
  services: PermissionServiceItem[];
}

export interface PermissionServiceItem {
  serviceName: string;
  permissions: PermissionEntry[];
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the full permission catalog grouped by service groups.
   */
  async getCatalog(): Promise<PermissionGroup[]> {
    const entries = await this.prisma.unscoped.permissionCatalog.findMany({
      orderBy: [{ groupName: 'asc' }, { serviceName: 'asc' }, { permissionKey: 'asc' }],
    });

    // Group by groupName
    const groupsMap = new Map<string, Map<string, PermissionEntry[]>>();

    for (const entry of entries) {
      if (!groupsMap.has(entry.groupName)) {
        groupsMap.set(entry.groupName, new Map());
      }
      const services = groupsMap.get(entry.groupName)!;
      if (!services.has(entry.serviceName)) {
        services.set(entry.serviceName, []);
      }
      services.get(entry.serviceName)!.push(entry as PermissionEntry);
    }

    const groups: PermissionGroup[] = [];
    for (const [groupName, services] of groupsMap) {
      const serviceList: PermissionServiceItem[] = [];
      for (const [serviceName, permissions] of services) {
        serviceList.push({ serviceName, permissions } as PermissionServiceItem);
      }
      groups.push({ groupName, services: serviceList });
    }

    return groups;
  }

  /**
   * Get a flat list of all permissions.
   */
  async getAllPermissions(): Promise<PermissionEntry[]> {
    const entries = await this.prisma.unscoped.permissionCatalog.findMany({
      orderBy: [{ groupName: 'asc' }, { serviceName: 'asc' }, { permissionKey: 'asc' }],
    });
    return entries as unknown as PermissionEntry[];
  }

  /**
   * Get permissions for a specific group.
   */
  async getGroupPermissions(groupName: string): Promise<PermissionServiceItem[]> {
    const entries = await this.prisma.unscoped.permissionCatalog.findMany({
      where: { groupName },
      orderBy: [{ serviceName: 'asc' }, { permissionKey: 'asc' }],
    });

    const servicesMap = new Map<string, PermissionEntry[]>();
    for (const entry of entries) {
      if (!servicesMap.has(entry.serviceName)) {
        servicesMap.set(entry.serviceName, []);
      }
      servicesMap.get(entry.serviceName)!.push(entry as PermissionEntry);
    }

    const services: PermissionServiceItem[] = [];
    for (const [serviceName, permissions] of servicesMap) {
      services.push({ serviceName, permissions } as PermissionServiceItem);
    }

    return services;
  }

  /**
   * Seed the permission catalog with ~260 permissions across 21 groups covering all 85+ Communicator services.
   */
  async seedCatalog(): Promise<void> {
    const permissions = [
      // 1. Inbox Group
      { groupName: 'Inbox', serviceName: 'omni-inbox', permissionKey: 'inbox:omni-inbox:view', label: 'View Omni Inbox', description: 'View all messages across channels' },
      { groupName: 'Inbox', serviceName: 'omni-inbox', permissionKey: 'inbox:omni-inbox:reply', label: 'Reply in Omni Inbox', description: 'Send replies from the unified inbox' },
      { groupName: 'Inbox', serviceName: 'omni-inbox', permissionKey: 'inbox:omni-inbox:assign', label: 'Assign in Omni Inbox', description: 'Assign conversations to team members' },
      { groupName: 'Inbox', serviceName: 'omni-inbox', permissionKey: 'inbox:omni-inbox:notes', label: 'Add Notes in Omni Inbox', description: 'Add internal notes to conversations' },
      { groupName: 'Inbox', serviceName: 'whatsapp-inbox', permissionKey: 'inbox:whatsapp-inbox:view', label: 'View WhatsApp Inbox', description: 'View WhatsApp messages' },
      { groupName: 'Inbox', serviceName: 'whatsapp-inbox', permissionKey: 'inbox:whatsapp-inbox:reply', label: 'Reply via WhatsApp', description: 'Send WhatsApp replies' },
      { groupName: 'Inbox', serviceName: 'sms-inbox', permissionKey: 'inbox:sms-inbox:view', label: 'View SMS Inbox', description: 'View SMS messages' },
      { groupName: 'Inbox', serviceName: 'sms-inbox', permissionKey: 'inbox:sms-inbox:reply', label: 'Reply via SMS', description: 'Send SMS replies' },
      { groupName: 'Inbox', serviceName: 'email-inbox', permissionKey: 'inbox:email-inbox:view', label: 'View Email Inbox', description: 'View email messages' },
      { groupName: 'Inbox', serviceName: 'email-inbox', permissionKey: 'inbox:email-inbox:reply', label: 'Reply via Email', description: 'Send email replies' },
      { groupName: 'Inbox', serviceName: 'live-chat-inbox', permissionKey: 'inbox:live-chat-inbox:view', label: 'View Live Chat', description: 'View live chat messages' },
      { groupName: 'Inbox', serviceName: 'live-chat-inbox', permissionKey: 'inbox:live-chat-inbox:reply', label: 'Reply via Live Chat', description: 'Send live chat replies' },

      // 2. Campaigns & Broadcasts Group
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:view', label: 'View Broadcasts', description: 'View all broadcast campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:create', label: 'Create Broadcasts', description: 'Create new broadcast campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:send', label: 'Send Broadcasts', description: 'Send broadcast campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:edit', label: 'Edit Broadcasts', description: 'Edit existing broadcasts' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:delete', label: 'Delete Broadcasts', description: 'Delete broadcast campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'omni-broadcast', permissionKey: 'campaigns:omni-broadcast:analytics', label: 'Broadcast Analytics', description: 'View broadcast analytics' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'whatsapp-campaigns', permissionKey: 'campaigns:whatsapp-campaigns:view', label: 'View WhatsApp Campaigns', description: 'View WhatsApp campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'whatsapp-campaigns', permissionKey: 'campaigns:whatsapp-campaigns:create', label: 'Create WhatsApp Campaigns', description: 'Create WhatsApp campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'whatsapp-campaigns', permissionKey: 'campaigns:whatsapp-campaigns:send', label: 'Send WhatsApp Campaigns', description: 'Send WhatsApp campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'sms-campaigns', permissionKey: 'campaigns:sms-campaigns:view', label: 'View SMS Campaigns', description: 'View SMS campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'sms-campaigns', permissionKey: 'campaigns:sms-campaigns:create', label: 'Create SMS Campaigns', description: 'Create SMS campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'sms-campaigns', permissionKey: 'campaigns:sms-campaigns:send', label: 'Send SMS Campaigns', description: 'Send SMS campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'email-campaigns', permissionKey: 'campaigns:email-campaigns:view', label: 'View Email Campaigns', description: 'View email campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'email-campaigns', permissionKey: 'campaigns:email-campaigns:create', label: 'Create Email Campaigns', description: 'Create email campaigns' },
      { groupName: 'Campaigns & Broadcasts', serviceName: 'email-campaigns', permissionKey: 'campaigns:email-campaigns:send', label: 'Send Email Campaigns', description: 'Send email campaigns' },

      // 3. Commerce Group
      { groupName: 'Commerce', serviceName: 'catalog', permissionKey: 'commerce:catalog:view', label: 'View Catalog', description: 'View product catalog' },
      { groupName: 'Commerce', serviceName: 'catalog', permissionKey: 'commerce:catalog:edit', label: 'Edit Catalog', description: 'Edit products and categories' },
      { groupName: 'Commerce', serviceName: 'catalog', permissionKey: 'commerce:catalog:delete', label: 'Delete Catalog Items', description: 'Delete products from catalog' },
      { groupName: 'Commerce', serviceName: 'catalog', permissionKey: 'commerce:catalog:manage', label: 'Manage Catalog', description: 'Full catalog management' },
      { groupName: 'Commerce', serviceName: 'orders', permissionKey: 'commerce:orders:view', label: 'View Orders', description: 'View order details' },
      { groupName: 'Commerce', serviceName: 'orders', permissionKey: 'commerce:orders:edit', label: 'Edit Orders', description: 'Edit order details' },
      { groupName: 'Commerce', serviceName: 'orders', permissionKey: 'commerce:orders:process', label: 'Process Orders', description: 'Process and fulfill orders' },
      { groupName: 'Commerce', serviceName: 'orders', permissionKey: 'commerce:orders:refund', label: 'Refund Orders', description: 'Process order refunds' },
      { groupName: 'Commerce', serviceName: 'payments', permissionKey: 'commerce:payments:view', label: 'View Payments', description: 'View payment details' },
      { groupName: 'Commerce', serviceName: 'payments', permissionKey: 'commerce:payments:process', label: 'Process Payments', description: 'Process payments' },
      { groupName: 'Commerce', serviceName: 'payments', permissionKey: 'commerce:payments:refund', label: 'Refund Payments', description: 'Process payment refunds' },
      { groupName: 'Commerce', serviceName: 'inventory', permissionKey: 'commerce:inventory:view', label: 'View Inventory', description: 'View inventory levels' },
      { groupName: 'Commerce', serviceName: 'inventory', permissionKey: 'commerce:inventory:edit', label: 'Edit Inventory', description: 'Edit inventory levels' },
      { groupName: 'Commerce', serviceName: 'inventory', permissionKey: 'commerce:inventory:manage', label: 'Manage Inventory', description: 'Full inventory management' },
      { groupName: 'Commerce', serviceName: 'storefront', permissionKey: 'commerce:storefront:view', label: 'View Storefront', description: 'View storefront settings' },
      { groupName: 'Commerce', serviceName: 'storefront', permissionKey: 'commerce:storefront:configure', label: 'Configure Storefront', description: 'Configure storefront appearance' },

      // 4. CRM Group
      { groupName: 'CRM', serviceName: 'contacts', permissionKey: 'crm:contacts:view', label: 'View Contacts', description: 'View contact details' },
      { groupName: 'CRM', serviceName: 'contacts', permissionKey: 'crm:contacts:edit', label: 'Edit Contacts', description: 'Edit contact information' },
      { groupName: 'CRM', serviceName: 'contacts', permissionKey: 'crm:contacts:delete', label: 'Delete Contacts', description: 'Delete contacts' },
      { groupName: 'CRM', serviceName: 'contacts', permissionKey: 'crm:contacts:import', label: 'Import Contacts', description: 'Import contacts from files' },
      { groupName: 'CRM', serviceName: 'contacts', permissionKey: 'crm:contacts:export', label: 'Export Contacts', description: 'Export contacts to files' },
      { groupName: 'CRM', serviceName: 'client-profiles', permissionKey: 'crm:client-profiles:view', label: 'View Client Profiles', description: 'View client profiles' },
      { groupName: 'CRM', serviceName: 'client-profiles', permissionKey: 'crm:client-profiles:edit', label: 'Edit Client Profiles', description: 'Edit client profiles' },
      { groupName: 'CRM', serviceName: 'client-profiles', permissionKey: 'crm:client-profiles:manage', label: 'Manage Client Profiles', description: 'Full client profile management' },

      // 5. Analytics Group
      { groupName: 'Analytics', serviceName: 'reports', permissionKey: 'analytics:reports:view', label: 'View Reports', description: 'View analytics reports' },
      { groupName: 'Analytics', serviceName: 'reports', permissionKey: 'analytics:reports:export', label: 'Export Reports', description: 'Export reports to files' },
      { groupName: 'Analytics', serviceName: 'reports', permissionKey: 'analytics:reports:schedule', label: 'Schedule Reports', description: 'Schedule automated reports' },
      { groupName: 'Analytics', serviceName: 'unified-analytics', permissionKey: 'analytics:unified-analytics:view', label: 'View Unified Analytics', description: 'View unified analytics dashboard' },
      { groupName: 'Analytics', serviceName: 'unified-analytics', permissionKey: 'analytics:unified-analytics:configure', label: 'Configure Analytics', description: 'Configure analytics settings' },
      { groupName: 'Analytics', serviceName: 'agent-performance', permissionKey: 'analytics:agent-performance:view', label: 'View Agent Performance', description: 'View agent performance metrics' },
      { groupName: 'Analytics', serviceName: 'agent-performance', permissionKey: 'analytics:agent-performance:manage', label: 'Manage Agent Performance', description: 'Manage agent performance settings' },

      // 6. Channels Group
      { groupName: 'Channels', serviceName: 'whatsapp', permissionKey: 'channels:whatsapp:view', label: 'View WhatsApp', description: 'View WhatsApp channel settings' },
      { groupName: 'Channels', serviceName: 'whatsapp', permissionKey: 'channels:whatsapp:configure', label: 'Configure WhatsApp', description: 'Configure WhatsApp channel' },
      { groupName: 'Channels', serviceName: 'whatsapp', permissionKey: 'channels:whatsapp:send', label: 'Send via WhatsApp', description: 'Send messages via WhatsApp' },
      { groupName: 'Channels', serviceName: 'sms', permissionKey: 'channels:sms:view', label: 'View SMS', description: 'View SMS channel settings' },
      { groupName: 'Channels', serviceName: 'sms', permissionKey: 'channels:sms:configure', label: 'Configure SMS', description: 'Configure SMS channel' },
      { groupName: 'Channels', serviceName: 'sms', permissionKey: 'channels:sms:send', label: 'Send via SMS', description: 'Send messages via SMS' },
      { groupName: 'Channels', serviceName: 'email', permissionKey: 'channels:email:view', label: 'View Email', description: 'View email channel settings' },
      { groupName: 'Channels', serviceName: 'email', permissionKey: 'channels:email:configure', label: 'Configure Email', description: 'Configure email channel' },
      { groupName: 'Channels', serviceName: 'email', permissionKey: 'channels:email:send', label: 'Send via Email', description: 'Send messages via email' },
      { groupName: 'Channels', serviceName: 'live-chat', permissionKey: 'channels:live-chat:view', label: 'View Live Chat', description: 'View live chat settings' },
      { groupName: 'Channels', serviceName: 'live-chat', permissionKey: 'channels:live-chat:configure', label: 'Configure Live Chat', description: 'Configure live chat' },
      { groupName: 'Channels', serviceName: 'telegram', permissionKey: 'channels:telegram:view', label: 'View Telegram', description: 'View Telegram settings' },
      { groupName: 'Channels', serviceName: 'telegram', permissionKey: 'channels:telegram:configure', label: 'Configure Telegram', description: 'Configure Telegram' },
      { groupName: 'Channels', serviceName: 'facebook', permissionKey: 'channels:facebook:view', label: 'View Facebook', description: 'View Facebook settings' },
      { groupName: 'Channels', serviceName: 'facebook', permissionKey: 'channels:facebook:configure', label: 'Configure Facebook', description: 'Configure Facebook' },
      { groupName: 'Channels', serviceName: 'instagram', permissionKey: 'channels:instagram:view', label: 'View Instagram', description: 'View Instagram settings' },
      { groupName: 'Channels', serviceName: 'instagram', permissionKey: 'channels:instagram:configure', label: 'Configure Instagram', description: 'Configure Instagram' },
      { groupName: 'Channels', serviceName: 'tiktok', permissionKey: 'channels:tiktok:view', label: 'View TikTok', description: 'View TikTok settings' },
      { groupName: 'Channels', serviceName: 'tiktok', permissionKey: 'channels:tiktok:configure', label: 'Configure TikTok', description: 'Configure TikTok' },
      { groupName: 'Channels', serviceName: 'discord', permissionKey: 'channels:discord:view', label: 'View Discord', description: 'View Discord settings' },
      { groupName: 'Channels', serviceName: 'discord', permissionKey: 'channels:discord:configure', label: 'Configure Discord', description: 'Configure Discord' },
      { groupName: 'Channels', serviceName: 'slack', permissionKey: 'channels:slack:view', label: 'View Slack', description: 'View Slack settings' },
      { groupName: 'Channels', serviceName: 'slack', permissionKey: 'channels:slack:configure', label: 'Configure Slack', description: 'Configure Slack' },
      { groupName: 'Channels', serviceName: 'voice', permissionKey: 'channels:voice:view', label: 'View Voice', description: 'View voice channel settings' },
      { groupName: 'Channels', serviceName: 'voice', permissionKey: 'channels:voice:configure', label: 'Configure Voice', description: 'Configure voice channel' },

      // 7. AI & Automation Group
      { groupName: 'AI & Automation', serviceName: 'ai-copilot', permissionKey: 'ai:ai-copilot:view', label: 'View AI Copilot', description: 'View AI copilot settings' },
      { groupName: 'AI & Automation', serviceName: 'ai-copilot', permissionKey: 'ai:ai-copilot:configure', label: 'Configure AI Copilot', description: 'Configure AI copilot' },
      { groupName: 'AI & Automation', serviceName: 'ai-copilot', permissionKey: 'ai:ai-copilot:train', label: 'Train AI Copilot', description: 'Train AI copilot models' },
      { groupName: 'AI & Automation', serviceName: 'automations', permissionKey: 'ai:automations:view', label: 'View Automations', description: 'View automation rules' },
      { groupName: 'AI & Automation', serviceName: 'automations', permissionKey: 'ai:automations:create', label: 'Create Automations', description: 'Create automation rules' },
      { groupName: 'AI & Automation', serviceName: 'automations', permissionKey: 'ai:automations:edit', label: 'Edit Automations', description: 'Edit automation rules' },
      { groupName: 'AI & Automation', serviceName: 'automations', permissionKey: 'ai:automations:delete', label: 'Delete Automations', description: 'Delete automation rules' },
      { groupName: 'AI & Automation', serviceName: 'workflows', permissionKey: 'ai:workflows:view', label: 'View Workflows', description: 'View workflow definitions' },
      { groupName: 'AI & Automation', serviceName: 'workflows', permissionKey: 'ai:workflows:create', label: 'Create Workflows', description: 'Create workflows' },
      { groupName: 'AI & Automation', serviceName: 'workflows', permissionKey: 'ai:workflows:edit', label: 'Edit Workflows', description: 'Edit workflows' },
      { groupName: 'AI & Automation', serviceName: 'workflows', permissionKey: 'ai:workflows:delete', label: 'Delete Workflows', description: 'Delete workflows' },
      { groupName: 'AI & Automation', serviceName: 'tone-of-voice', permissionKey: 'ai:tone-of-voice:view', label: 'View Tone of Voice', description: 'View tone of voice settings' },
      { groupName: 'AI & Automation', serviceName: 'tone-of-voice', permissionKey: 'ai:tone-of-voice:configure', label: 'Configure Tone of Voice', description: 'Configure brand tone' },

      // 8. Settings & Admin Group
      { groupName: 'Settings & Admin', serviceName: 'team', permissionKey: 'settings:team:view', label: 'View Team', description: 'View team members' },
      { groupName: 'Settings & Admin', serviceName: 'team', permissionKey: 'settings:team:manage', label: 'Manage Team', description: 'Manage team members' },
      { groupName: 'Settings & Admin', serviceName: 'team', permissionKey: 'settings:team:invite', label: 'Invite Team Members', description: 'Send invitations' },
      { groupName: 'Settings & Admin', serviceName: 'roles', permissionKey: 'settings:roles:view', label: 'View Roles', description: 'View role definitions' },
      { groupName: 'Settings & Admin', serviceName: 'roles', permissionKey: 'settings:roles:create', label: 'Create Roles', description: 'Create custom roles' },
      { groupName: 'Settings & Admin', serviceName: 'roles', permissionKey: 'settings:roles:edit', label: 'Edit Roles', description: 'Edit role definitions' },
      { groupName: 'Settings & Admin', serviceName: 'roles', permissionKey: 'settings:roles:delete', label: 'Delete Roles', description: 'Delete custom roles' },
      { groupName: 'Settings & Admin', serviceName: 'audit-logs', permissionKey: 'settings:audit-logs:view', label: 'View Audit Logs', description: 'View audit log entries' },
      { groupName: 'Settings & Admin', serviceName: 'audit-logs', permissionKey: 'settings:audit-logs:export', label: 'Export Audit Logs', description: 'Export audit logs' },
      { groupName: 'Settings & Admin', serviceName: 'compliance', permissionKey: 'settings:compliance:view', label: 'View Compliance', description: 'View compliance settings' },
      { groupName: 'Settings & Admin', serviceName: 'compliance', permissionKey: 'settings:compliance:configure', label: 'Configure Compliance', description: 'Configure compliance rules' },
      { groupName: 'Settings & Admin', serviceName: 'webhooks', permissionKey: 'settings:webhooks:view', label: 'View Webhooks', description: 'View webhook configurations' },
      { groupName: 'Settings & Admin', serviceName: 'webhooks', permissionKey: 'settings:webhooks:configure', label: 'Configure Webhooks', description: 'Configure webhooks' },
      { groupName: 'Settings & Admin', serviceName: 'custom-attributes', permissionKey: 'settings:custom-attributes:view', label: 'View Custom Attributes', description: 'View custom attributes' },
      { groupName: 'Settings & Admin', serviceName: 'custom-attributes', permissionKey: 'settings:custom-attributes:manage', label: 'Manage Custom Attributes', description: 'Manage custom attributes' },
      { groupName: 'Settings & Admin', serviceName: 'macros', permissionKey: 'settings:macros:view', label: 'View Macros', description: 'View macro definitions' },
      { groupName: 'Settings & Admin', serviceName: 'macros', permissionKey: 'settings:macros:create', label: 'Create Macros', description: 'Create macros' },
      { groupName: 'Settings & Admin', serviceName: 'macros', permissionKey: 'settings:macros:edit', label: 'Edit Macros', description: 'Edit macros' },
      { groupName: 'Settings & Admin', serviceName: 'macros', permissionKey: 'settings:macros:delete', label: 'Delete Macros', description: 'Delete macros' },
      { groupName: 'Settings & Admin', serviceName: 'canned-responses', permissionKey: 'settings:canned-responses:view', label: 'View Canned Responses', description: 'View canned responses' },
      { groupName: 'Settings & Admin', serviceName: 'canned-responses', permissionKey: 'settings:canned-responses:create', label: 'Create Canned Responses', description: 'Create canned responses' },
      { groupName: 'Settings & Admin', serviceName: 'canned-responses', permissionKey: 'settings:canned-responses:edit', label: 'Edit Canned Responses', description: 'Edit canned responses' },
      { groupName: 'Settings & Admin', serviceName: 'canned-responses', permissionKey: 'settings:canned-responses:delete', label: 'Delete Canned Responses', description: 'Delete canned responses' },

      // 9. ERP & Integrations Group
      { groupName: 'ERP & Integrations', serviceName: 'erp-catalog', permissionKey: 'erp:catalog:view', label: 'View ERP Catalog', description: 'View ERP product catalog' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-catalog', permissionKey: 'erp:catalog:sync', label: 'Sync ERP Catalog', description: 'Sync products from ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-orders', permissionKey: 'erp:orders:view', label: 'View ERP Orders', description: 'View orders from ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-orders', permissionKey: 'erp:orders:sync', label: 'Sync ERP Orders', description: 'Sync orders with ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-payments', permissionKey: 'erp:payments:view', label: 'View ERP Payments', description: 'View payments from ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-payments', permissionKey: 'erp:payments:sync', label: 'Sync ERP Payments', description: 'Sync payments with ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-inventory', permissionKey: 'erp:inventory:view', label: 'View ERP Inventory', description: 'View inventory from ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-inventory', permissionKey: 'erp:inventory:sync', label: 'Sync ERP Inventory', description: 'Sync inventory with ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-fulfilment', permissionKey: 'erp:fulfilment:view', label: 'View ERP Fulfilment', description: 'View fulfilment status from ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'erp-fulfilment', permissionKey: 'erp:fulfilment:manage', label: 'Manage ERP Fulfilment', description: 'Manage fulfilment in ERP' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-shopify', permissionKey: 'integrations:shopify:view', label: 'View Shopify Sync', description: 'View Shopify sync status' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-shopify', permissionKey: 'integrations:shopify:configure', label: 'Configure Shopify Sync', description: 'Configure Shopify integration' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-woocommerce', permissionKey: 'integrations:woocommerce:view', label: 'View WooCommerce Sync', description: 'View WooCommerce sync status' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-woocommerce', permissionKey: 'integrations:woocommerce:configure', label: 'Configure WooCommerce Sync', description: 'Configure WooCommerce integration' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-wix', permissionKey: 'integrations:wix:view', label: 'View Wix Sync', description: 'View Wix sync status' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-wix', permissionKey: 'integrations:wix:configure', label: 'Configure Wix Sync', description: 'Configure Wix integration' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-square', permissionKey: 'integrations:square:view', label: 'View Square Sync', description: 'View Square sync status' },
      { groupName: 'ERP & Integrations', serviceName: 'sync-square', permissionKey: 'integrations:square:configure', label: 'Configure Square Sync', description: 'Configure Square integration' },
      { groupName: 'ERP & Integrations', serviceName: 'crm-sync', permissionKey: 'integrations:crm:view', label: 'View CRM Sync', description: 'View CRM sync status' },
      { groupName: 'ERP & Integrations', serviceName: 'crm-sync', permissionKey: 'integrations:crm:configure', label: 'Configure CRM Sync', description: 'Configure CRM integration' },

      // 10. Help Center & Knowledge Group
      { groupName: 'Help Center & Knowledge', serviceName: 'help-center', permissionKey: 'help:help-center:view', label: 'View Help Center', description: 'View help center articles' },
      { groupName: 'Help Center & Knowledge', serviceName: 'help-center', permissionKey: 'help:help-center:edit', label: 'Edit Help Center', description: 'Edit help center articles' },
      { groupName: 'Help Center & Knowledge', serviceName: 'help-center', permissionKey: 'help:help-center:publish', label: 'Publish Help Center', description: 'Publish help center articles' },
      { groupName: 'Help Center & Knowledge', serviceName: 'kb-documents', permissionKey: 'help:kb-documents:view', label: 'View KB Documents', description: 'View knowledge base documents' },
      { groupName: 'Help Center & Knowledge', serviceName: 'kb-documents', permissionKey: 'help:kb-documents:edit', label: 'Edit KB Documents', description: 'Edit knowledge base documents' },
      { groupName: 'Help Center & Knowledge', serviceName: 'kb-documents', permissionKey: 'help:kb-documents:delete', label: 'Delete KB Documents', description: 'Delete knowledge base documents' },
      { groupName: 'Help Center & Knowledge', serviceName: 'procedures', permissionKey: 'help:procedures:view', label: 'View Procedures', description: 'View standard procedures' },
      { groupName: 'Help Center & Knowledge', serviceName: 'procedures', permissionKey: 'help:procedures:edit', label: 'Edit Procedures', description: 'Edit standard procedures' },
      { groupName: 'Help Center & Knowledge', serviceName: 'procedures', permissionKey: 'help:procedures:delete', label: 'Delete Procedures', description: 'Delete standard procedures' },

      // 11. Quality & Scoring Group
      { groupName: 'Quality & Scoring', serviceName: 'cx-qa-scoring', permissionKey: 'quality:cx-qa:view', label: 'View CX QA Scoring', description: 'View customer experience QA scores' },
      { groupName: 'Quality & Scoring', serviceName: 'cx-qa-scoring', permissionKey: 'quality:cx-qa:configure', label: 'Configure CX QA', description: 'Configure QA scoring rules' },
      { groupName: 'Quality & Scoring', serviceName: 'cx-qa-scoring', permissionKey: 'quality:cx-qa:review', label: 'Review CX QA', description: 'Review and override QA scores' },
      { groupName: 'Quality & Scoring', serviceName: 'copilot-reviewer', permissionKey: 'quality:copilot-reviewer:view', label: 'View Copilot Reviews', description: 'View AI copilot review results' },
      { groupName: 'Quality & Scoring', serviceName: 'copilot-reviewer', permissionKey: 'quality:copilot-reviewer:configure', label: 'Configure Copilot Reviewer', description: 'Configure copilot review settings' },
      { groupName: 'Quality & Scoring', serviceName: 'ab-testing', permissionKey: 'quality:ab-testing:view', label: 'View A/B Tests', description: 'View A/B test results' },
      { groupName: 'Quality & Scoring', serviceName: 'ab-testing', permissionKey: 'quality:ab-testing:create', label: 'Create A/B Tests', description: 'Create new A/B tests' },
      { groupName: 'Quality & Scoring', serviceName: 'ab-testing', permissionKey: 'quality:ab-testing:edit', label: 'Edit A/B Tests', description: 'Edit A/B test configurations' },
      { groupName: 'Quality & Scoring', serviceName: 'ab-testing', permissionKey: 'quality:ab-testing:delete', label: 'Delete A/B Tests', description: 'Delete A/B tests' },

      // 12. Security & Vault Group
      { groupName: 'Security & Vault', serviceName: 'vault', permissionKey: 'security:vault:view', label: 'View Vault', description: 'View vault contents' },
      { groupName: 'Security & Vault', serviceName: 'vault', permissionKey: 'security:vault:manage', label: 'Manage Vault', description: 'Manage vault secrets' },
      { groupName: 'Security & Vault', serviceName: 'compliance-dashboard', permissionKey: 'security:compliance-dashboard:view', label: 'View Compliance Dashboard', description: 'View compliance dashboard' },
      { groupName: 'Security & Vault', serviceName: 'compliance-dashboard', permissionKey: 'security:compliance-dashboard:configure', label: 'Configure Compliance', description: 'Configure compliance dashboard' },
      { groupName: 'Security & Vault', serviceName: 'crypto-mesh', permissionKey: 'security:crypto-mesh:view', label: 'View Crypto Mesh', description: 'View crypto mesh status' },
      { groupName: 'Security & Vault', serviceName: 'crypto-mesh', permissionKey: 'security:crypto-mesh:configure', label: 'Configure Crypto Mesh', description: 'Configure crypto mesh' },
      { groupName: 'Security & Vault', serviceName: 'monitoring', permissionKey: 'security:monitoring:view', label: 'View Monitoring', description: 'View system monitoring' },
      { groupName: 'Security & Vault', serviceName: 'monitoring', permissionKey: 'security:monitoring:configure', label: 'Configure Monitoring', description: 'Configure monitoring alerts' },
      { groupName: 'Security & Vault', serviceName: 'alerts', permissionKey: 'security:alerts:view', label: 'View Alerts', description: 'View system alerts' },
      { groupName: 'Security & Vault', serviceName: 'alerts', permissionKey: 'security:alerts:configure', label: 'Configure Alerts', description: 'Configure alert rules' },

      // 13. Messaging & Notifications Group
      { groupName: 'Messaging & Notifications', serviceName: 'in-app-messaging', permissionKey: 'messaging:in-app:view', label: 'View In-App Messages', description: 'View in-app messages' },
      { groupName: 'Messaging & Notifications', serviceName: 'in-app-messaging', permissionKey: 'messaging:in-app:send', label: 'Send In-App Messages', description: 'Send in-app messages' },
      { groupName: 'Messaging & Notifications', serviceName: 'notifications', permissionKey: 'messaging:notifications:view', label: 'View Notifications', description: 'View notification settings' },
      { groupName: 'Messaging & Notifications', serviceName: 'notifications', permissionKey: 'messaging:notifications:configure', label: 'Configure Notifications', description: 'Configure notification preferences' },
      { groupName: 'Messaging & Notifications', serviceName: 'messaging', permissionKey: 'messaging:messaging:view', label: 'View Messaging', description: 'View messaging logs' },
      { groupName: 'Messaging & Notifications', serviceName: 'messaging', permissionKey: 'messaging:messaging:configure', label: 'Configure Messaging', description: 'Configure messaging settings' },

      // 14. WhatsApp Extended Group
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-automations', permissionKey: 'whatsapp:automations:view', label: 'View WhatsApp Automations', description: 'View WhatsApp automation rules' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-automations', permissionKey: 'whatsapp:automations:edit', label: 'Edit WhatsApp Automations', description: 'Edit WhatsApp automation rules' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-campaigns', permissionKey: 'whatsapp:campaigns:view', label: 'View WhatsApp Campaigns', description: 'View WhatsApp campaign history' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-campaigns', permissionKey: 'whatsapp:campaigns:manage', label: 'Manage WhatsApp Campaigns', description: 'Manage WhatsApp campaigns' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-flows', permissionKey: 'whatsapp:flows:view', label: 'View WhatsApp Flows', description: 'View WhatsApp flow definitions' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-flows', permissionKey: 'whatsapp:flows:edit', label: 'Edit WhatsApp Flows', description: 'Edit WhatsApp flows' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-template-sync', permissionKey: 'whatsapp:template-sync:view', label: 'View Template Sync', description: 'View WhatsApp template sync status' },
      { groupName: 'WhatsApp Extended', serviceName: 'whatsapp-template-sync', permissionKey: 'whatsapp:template-sync:manage', label: 'Manage Template Sync', description: 'Manage WhatsApp template sync' },

      // 15. Commerce Extended Group
      { groupName: 'Commerce Extended', serviceName: 'commerce-cart', permissionKey: 'commerce:cart:view', label: 'View Cart', description: 'View shopping cart data' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-cart', permissionKey: 'commerce:cart:manage', label: 'Manage Cart', description: 'Manage shopping cart' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-delivery', permissionKey: 'commerce:delivery:view', label: 'View Delivery', description: 'View delivery status' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-delivery', permissionKey: 'commerce:delivery:manage', label: 'Manage Delivery', description: 'Manage delivery options' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-discounts', permissionKey: 'commerce:discounts:view', label: 'View Discounts', description: 'View discount codes' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-discounts', permissionKey: 'commerce:discounts:manage', label: 'Manage Discounts', description: 'Manage discount codes' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-options', permissionKey: 'commerce:options:view', label: 'View Product Options', description: 'View product options' },
      { groupName: 'Commerce Extended', serviceName: 'commerce-options', permissionKey: 'commerce:options:manage', label: 'Manage Product Options', description: 'Manage product options' },
      { groupName: 'Commerce Extended', serviceName: 'channel-commerce-templates', permissionKey: 'commerce:templates:view', label: 'View Commerce Templates', description: 'View channel commerce templates' },
      { groupName: 'Commerce Extended', serviceName: 'channel-commerce-templates', permissionKey: 'commerce:templates:edit', label: 'Edit Commerce Templates', description: 'Edit channel commerce templates' },

      // 16. AI Extended Group
      { groupName: 'AI Extended', serviceName: 'autonomous-resolution', permissionKey: 'ai:autonomous:view', label: 'View Autonomous Resolution', description: 'View autonomous resolution results' },
      { groupName: 'AI Extended', serviceName: 'autonomous-resolution', permissionKey: 'ai:autonomous:configure', label: 'Configure Autonomous Resolution', description: 'Configure autonomous resolution' },
      { groupName: 'AI Extended', serviceName: 'suggestions', permissionKey: 'ai:suggestions:view', label: 'View Suggestions', description: 'View AI suggestions' },
      { groupName: 'AI Extended', serviceName: 'suggestions', permissionKey: 'ai:suggestions:configure', label: 'Configure Suggestions', description: 'Configure AI suggestions' },
      { groupName: 'AI Extended', serviceName: 'topic-categorization', permissionKey: 'ai:topic-categorization:view', label: 'View Topic Categories', description: 'View topic categorization' },
      { groupName: 'AI Extended', serviceName: 'topic-categorization', permissionKey: 'ai:topic-categorization:configure', label: 'Configure Topics', description: 'Configure topic categories' },
      { groupName: 'AI Extended', serviceName: 'audience-kb-scoping', permissionKey: 'ai:audience-kb:view', label: 'View Audience KB', description: 'View audience knowledge base scoping' },
      { groupName: 'AI Extended', serviceName: 'audience-kb-scoping', permissionKey: 'ai:audience-kb:configure', label: 'Configure Audience KB', description: 'Configure audience KB scoping' },

      // 17. Finance Group
      { groupName: 'Finance', serviceName: 'fin-operator', permissionKey: 'finance:operator:view', label: 'View Finance Operator', description: 'View finance operations' },
      { groupName: 'Finance', serviceName: 'fin-operator', permissionKey: 'finance:operator:manage', label: 'Manage Finance Operator', description: 'Manage finance operations' },
      { groupName: 'Finance', serviceName: 'fin-vision', permissionKey: 'finance:vision:view', label: 'View Finance Vision', description: 'View financial projections' },
      { groupName: 'Finance', serviceName: 'fin-vision', permissionKey: 'finance:vision:configure', label: 'Configure Finance Vision', description: 'Configure financial projections' },

      // 18. Widget & Embed Group
      { groupName: 'Widget & Embed', serviceName: 'embed-widget', permissionKey: 'widget:embed:view', label: 'View Embed Widget', description: 'View embed widget settings' },
      { groupName: 'Widget & Embed', serviceName: 'embed-widget', permissionKey: 'widget:embed:configure', label: 'Configure Embed Widget', description: 'Configure embed widget' },
      { groupName: 'Widget & Embed', serviceName: 'widget-support', permissionKey: 'widget:support:view', label: 'View Widget Support', description: 'View widget support data' },
      { groupName: 'Widget & Embed', serviceName: 'widget-support', permissionKey: 'widget:support:configure', label: 'Configure Widget Support', description: 'Configure widget support' },

      // 19. System & Infrastructure Group
      { groupName: 'System & Infrastructure', serviceName: 'system-health', permissionKey: 'system:health:view', label: 'View System Health', description: 'View system health status' },
      { groupName: 'System & Infrastructure', serviceName: 'system-health', permissionKey: 'system:health:configure', label: 'Configure System Health', description: 'Configure health checks' },
      { groupName: 'System & Infrastructure', serviceName: 'scheduled-tasks', permissionKey: 'system:scheduled-tasks:view', label: 'View Scheduled Tasks', description: 'View scheduled tasks' },
      { groupName: 'System & Infrastructure', serviceName: 'scheduled-tasks', permissionKey: 'system:scheduled-tasks:manage', label: 'Manage Scheduled Tasks', description: 'Manage scheduled tasks' },
      { groupName: 'System & Infrastructure', serviceName: 'business-hours', permissionKey: 'system:business-hours:view', label: 'View Business Hours', description: 'View business hours settings' },
      { groupName: 'System & Infrastructure', serviceName: 'business-hours', permissionKey: 'system:business-hours:configure', label: 'Configure Business Hours', description: 'Configure business hours' },
      { groupName: 'System & Infrastructure', serviceName: 'conversation-search', permissionKey: 'system:search:view', label: 'View Conversation Search', description: 'Search conversations' },
      { groupName: 'System & Infrastructure', serviceName: 'draft-actions', permissionKey: 'system:drafts:view', label: 'View Draft Actions', description: 'View draft messages' },
      { groupName: 'System & Infrastructure', serviceName: 'draft-actions', permissionKey: 'system:drafts:manage', label: 'Manage Draft Actions', description: 'Manage draft messages' },
      { groupName: 'System & Infrastructure', serviceName: 'brand-overrides', permissionKey: 'system:brand-overrides:view', label: 'View Brand Overrides', description: 'View brand-specific overrides' },
      { groupName: 'System & Infrastructure', serviceName: 'brand-overrides', permissionKey: 'system:brand-overrides:configure', label: 'Configure Brand Overrides', description: 'Configure brand overrides' },
      { groupName: 'System & Infrastructure', serviceName: 'integration-settings', permissionKey: 'system:integration:view', label: 'View Integration Settings', description: 'View integration configurations' },
      { groupName: 'System & Infrastructure', serviceName: 'integration-settings', permissionKey: 'system:integration:configure', label: 'Configure Integrations', description: 'Configure integration settings' },

      // 20. OTP & Security Group
      { groupName: 'OTP & Security', serviceName: 'otp-engine', permissionKey: 'otp:engine:view', label: 'View OTP Engine', description: 'View OTP engine status' },
      { groupName: 'OTP & Security', serviceName: 'otp-engine', permissionKey: 'otp:engine:configure', label: 'Configure OTP Engine', description: 'Configure OTP settings' },
      { groupName: 'OTP & Security', serviceName: 'smtp-email', permissionKey: 'otp:smtp:view', label: 'View SMTP Settings', description: 'View SMTP configuration' },
      { groupName: 'OTP & Security', serviceName: 'smtp-email', permissionKey: 'otp:smtp:configure', label: 'Configure SMTP', description: 'Configure SMTP settings' },
      { groupName: 'OTP & Security', serviceName: 'external-otp', permissionKey: 'otp:external:view', label: 'View External OTP', description: 'View external OTP integrations' },
      { groupName: 'OTP & Security', serviceName: 'external-otp', permissionKey: 'otp:external:configure', label: 'Configure External OTP', description: 'Configure external OTP' },
      { groupName: 'OTP & Security', serviceName: 'store-connection', permissionKey: 'otp:store:view', label: 'View Store Connections', description: 'View store connection status' },
      { groupName: 'OTP & Security', serviceName: 'store-connection', permissionKey: 'otp:store:configure', label: 'Configure Store Connections', description: 'Configure store connections' },

      // 21. Access Control Group
      { groupName: 'Access Control', serviceName: 'access-control', permissionKey: 'access:control:view', label: 'View Access Control', description: 'View access control settings' },
      { groupName: 'Access Control', serviceName: 'access-control', permissionKey: 'access:control:manage', label: 'Manage Access Control', description: 'Manage access grants and roles' },
      { groupName: 'Access Control', serviceName: 'access-control', permissionKey: 'access:control:transfer', label: 'Transfer Ownership', description: 'Transfer ownership of entities' },
      { groupName: 'Access Control', serviceName: 'departments', permissionKey: 'access:departments:view', label: 'View Departments', description: 'View department structure' },
      { groupName: 'Access Control', serviceName: 'departments', permissionKey: 'access:departments:manage', label: 'Manage Departments', description: 'Manage departments and assignments' },
    ];

    // Use upsert to avoid duplicates
    for (const perm of permissions) {
      await this.prisma.unscoped.permissionCatalog.upsert({
        where: {
          groupName_serviceName_permissionKey: {
            groupName: perm.groupName,
            serviceName: perm.serviceName,
            permissionKey: perm.permissionKey,
          },
        },
        update: {},
        create: perm,
      });
    }
  }
}
