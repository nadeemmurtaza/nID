pub mod access {
    pub mod v1 {
        tonic::include_proto!("newax.access.v1");
    }
}

pub mod permissions {
    pub mod v1 {
        tonic::include_proto!("newax.permissions.v1");
    }
}

pub mod tenant_staff {
    pub mod v1 {
        tonic::include_proto!("newax.tenant_staff.v1");
    }
}

pub mod departments {
    pub mod v1 {
        tonic::include_proto!("newax.departments.v1");
    }
}

pub mod account_verification {
    pub mod v1 {
        tonic::include_proto!("newax.account_verification.v1");
    }
}

pub mod subjects {
    pub mod v1 {
        tonic::include_proto!("newax.subjects.v1");
    }
}

pub mod invitations {
    pub mod v1 {
        tonic::include_proto!("newax.invitations.v1");
    }
}

pub mod oauth {
    pub mod v1 {
        tonic::include_proto!("newax.oauth.v1");
    }
}

pub mod accounts {
    pub mod v1 {
        tonic::include_proto!("newax.accounts.v1");
    }
}

pub mod roles {
    pub mod v1 {
        tonic::include_proto!("newax.roles.v1");
    }
}

pub mod booking {
    pub mod v1 {
        tonic::include_proto!("newax.booking.v1");
    }
}

pub mod organization_profiles {
    pub mod v1 {
        tonic::include_proto!("newax.organization_profiles.v1");
    }
}

pub mod verification_cases {
    pub mod v1 {
        tonic::include_proto!("newax.verification_cases.v1");
    }
}

pub mod organizations {
    pub mod v1 {
        tonic::include_proto!("newax.organizations.v1");
    }
}

pub mod tenants {
    pub mod v1 {
        tonic::include_proto!("newax.tenants.v1");
    }
}

pub mod sessions {
    pub mod v1 {
        tonic::include_proto!("newax.sessions.v1");
    }
}

pub mod profile_content {
    pub mod v1 {
        tonic::include_proto!("newax.profile_content.v1");
    }
}
