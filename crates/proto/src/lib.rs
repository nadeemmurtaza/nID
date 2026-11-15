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
