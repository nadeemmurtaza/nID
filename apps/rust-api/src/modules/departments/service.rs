//! Departments service -- gRPC client for `svc-departments`.
//!
//! Business logic moved to `crates/departments`, served by
//! `services/departments` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::departments::v1::{
    departments_service_client::DepartmentsServiceClient, AccountDepartmentsRequest, AssignDepartmentRequest as GrpcAssignRequest,
    CreateDepartmentRequest as GrpcCreateRequest, DepartmentIdRequest, RemoveAssignmentRequest, TenantScopedRequest,
    UpdateDepartmentRequest as GrpcUpdateRequest,
};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::departments::dto::{
    AssignDepartmentRequest, CreateDepartmentRequest, DepartmentAssignmentResponse, DepartmentResponse,
    UpdateDepartmentRequest,
};

pub struct DepartmentsService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn dept_from_proto(d: newax_proto::departments::v1::DepartmentResponse) -> DepartmentResponse {
    DepartmentResponse {
        id: d.id,
        tenant_id: d.tenant_id,
        name: d.name,
        slug: d.slug,
        default_permissions: d.default_permissions_json.and_then(|s| serde_json::from_str(&s).ok()),
        icon: d.icon,
        color: d.color,
        inherited_from_tenant: d.inherited_from_tenant,
        created_at: d.created_at,
        updated_at: d.updated_at,
    }
}

fn assignment_from_proto(a: newax_proto::departments::v1::DepartmentAssignmentResponse) -> DepartmentAssignmentResponse {
    DepartmentAssignmentResponse {
        id: a.id,
        account_id: a.account_id,
        department_id: a.department_id,
        tenant_id: a.tenant_id,
        organization_id: a.organization_id,
        brand_id: a.brand_id,
        scope: a.scope,
        created_at: a.created_at,
    }
}

async fn client() -> Result<DepartmentsServiceClient<nid_service_auth::AuthedChannel>> {
    let url = std::env::var("DEPARTMENTS_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:50073".to_string());
    nid_service_auth::connect(url).await.map(DepartmentsServiceClient::new).map_err(|e| anyhow!("departments service unreachable: {e}"))
}

impl DepartmentsService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn create_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        req: &CreateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut c = client().await?;
        let resp = c
            .create_department(GrpcCreateRequest {
                account_id: account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                name: req.name.clone(),
                slug: req.slug.clone(),
                default_permissions_json: req.default_permissions.as_ref().map(|v| v.to_string()),
                icon: req.icon.clone(),
                color: req.color.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(dept_from_proto(resp.into_inner()))
    }

    pub async fn list_departments(&self, account_id: &str, tenant_id: &str) -> Result<Vec<DepartmentResponse>> {
        let mut c = client().await?;
        let resp = c
            .list_departments(TenantScopedRequest { account_id: account_id.to_string(), tenant_id: tenant_id.to_string() })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().departments.into_iter().map(dept_from_proto).collect())
    }

    pub async fn get_department(&self, account_id: &str, tenant_id: &str, dept_id: &str) -> Result<DepartmentResponse> {
        let mut c = client().await?;
        let resp = c
            .get_department(DepartmentIdRequest {
                account_id: account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                department_id: dept_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(dept_from_proto(resp.into_inner()))
    }

    pub async fn update_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        req: &UpdateDepartmentRequest,
    ) -> Result<DepartmentResponse> {
        let mut c = client().await?;
        let resp = c
            .update_department(GrpcUpdateRequest {
                account_id: account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                department_id: dept_id.to_string(),
                name: req.name.clone(),
                default_permissions_json: req.default_permissions.as_ref().map(|v| v.to_string()),
                icon_set: req.icon.is_some(),
                icon: req.icon.clone().flatten(),
                color_set: req.color.is_some(),
                color: req.color.clone().flatten(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(dept_from_proto(resp.into_inner()))
    }

    pub async fn assign_department(
        &self,
        account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        req: &AssignDepartmentRequest,
    ) -> Result<DepartmentAssignmentResponse> {
        let mut c = client().await?;
        let resp = c
            .assign_department(GrpcAssignRequest {
                account_id: account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                department_id: dept_id.to_string(),
                target_account_id: req.account_id.clone(),
                organization_id: req.organization_id.clone(),
                brand_id: req.brand_id.clone(),
                scope: req.scope.clone(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(assignment_from_proto(resp.into_inner()))
    }

    pub async fn remove_department_assignment(
        &self,
        caller_account_id: &str,
        tenant_id: &str,
        dept_id: &str,
        account_id: &str,
    ) -> Result<()> {
        let mut c = client().await?;
        c.remove_department_assignment(RemoveAssignmentRequest {
            account_id: caller_account_id.to_string(),
            tenant_id: tenant_id.to_string(),
            department_id: dept_id.to_string(),
            target_account_id: account_id.to_string(),
        })
        .await
        .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(())
    }

    pub async fn get_account_departments(
        &self,
        caller_account_id: &str,
        tenant_id: &str,
        account_id: &str,
    ) -> Result<Vec<DepartmentAssignmentResponse>> {
        let mut c = client().await?;
        let resp = c
            .get_account_departments(AccountDepartmentsRequest {
                account_id: caller_account_id.to_string(),
                tenant_id: tenant_id.to_string(),
                target_account_id: account_id.to_string(),
            })
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(resp.into_inner().assignments.into_iter().map(assignment_from_proto).collect())
    }
}
