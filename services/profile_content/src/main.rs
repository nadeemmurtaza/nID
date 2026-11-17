use newax_profile_content::{
    BusinessHourResponse, ContactMessageResponse, CustomLinkResponse, OfferResponse, ProfileContentService,
    ProfileImageResponse, ProfileOwner, SocialLinkResponse,
};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.profile_content.v1");
}

use proto::{
    profile_content_api_service_server::{
        ProfileContentApiService as ProfileContentRpc, ProfileContentApiServiceServer,
    },
    AccountIdRequest, BusinessHourListResponse, BusinessHourResponse as ProtoBusinessHour,
    ContactMessageListResponse, ContactMessageResponse as ProtoContactMessage,
    CustomLinkListResponse, CustomLinkResponse as ProtoCustomLink,
    CreateCustomLinkRequest as ProtoCreateCustomLink,
    CreateOfferRequest as ProtoCreateOffer,
    CreatePublicContactMessageRequest,
    CreateSocialLinkRequest as ProtoCreateSocialLink,
    Empty, GetPublicImageRequest, ImageUrlResponse,
    MarkContactMessageReadRequest, OfferListResponse, OfferResponse as ProtoOffer,
    ProfileImageListResponse, ProfileImageResponse as ProtoProfileImage,
    PublicLinksResponse, RemoveBusinessHourRequest, RemoveCustomLinkRequest,
    RemoveImageRequest, RemoveOfferRequest, RemoveSocialLinkRequest,
    SocialLinkListResponse, SocialLinkResponse as ProtoSocialLink,
    SlugRequest, UpdateCustomLinkRequest as ProtoUpdateCustomLink,
    UpdateOfferRequest as ProtoUpdateOffer,
    UpdateSocialLinkRequest as ProtoUpdateSocialLink,
    UploadGalleryImageRequest, UploadPhotoRequest,
    UpsertBusinessHourRequest,
};

struct ProfileContentGrpc {
    service: ProfileContentService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") || msg.contains("has no public profile yet") {
        Status::not_found(msg)
    } else if msg.contains("not authorized") {
        Status::permission_denied(msg)
    } else if msg.contains("must be verified") {
        Status::failed_precondition(msg)
    } else {
        Status::internal(msg)
    }
}

fn owner_of<'a>(account_id: &'a str, organization_id: &'a Option<String>) -> ProfileOwner<'a> {
    match organization_id {
        Some(org_id) if !org_id.is_empty() => ProfileOwner::Organization(account_id, org_id),
        _ => ProfileOwner::Account(account_id),
    }
}

fn offer_to_proto(o: OfferResponse) -> ProtoOffer {
    ProtoOffer {
        id: o.id,
        profile_id: o.profile_id,
        title: o.title,
        description: o.description,
        valid_until: o.valid_until,
        is_active: o.is_active,
    }
}

fn business_hour_to_proto(b: BusinessHourResponse) -> ProtoBusinessHour {
    ProtoBusinessHour {
        id: b.id,
        profile_id: b.profile_id,
        day: b.day,
        open_minute: b.open_minute,
        close_minute: b.close_minute,
        is_closed: b.is_closed,
    }
}

fn custom_link_to_proto(c: CustomLinkResponse) -> ProtoCustomLink {
    ProtoCustomLink {
        id: c.id,
        profile_id: c.profile_id,
        label: c.label,
        url: c.url,
        order_idx: c.order,
    }
}

fn social_link_to_proto(s: SocialLinkResponse) -> ProtoSocialLink {
    ProtoSocialLink {
        id: s.id,
        profile_id: s.profile_id,
        platform: s.platform,
        url: s.url,
        order_idx: s.order,
    }
}

fn profile_image_to_proto(p: ProfileImageResponse) -> ProtoProfileImage {
    ProtoProfileImage {
        id: p.id,
        profile_id: p.profile_id,
        kind: p.kind,
        url: p.url,
        content_type: p.content_type,
        created_at: p.created_at,
    }
}

fn contact_message_to_proto(c: ContactMessageResponse) -> ProtoContactMessage {
    ProtoContactMessage {
        id: c.id,
        profile_id: c.profile_id,
        sender_name: c.sender_name,
        sender_phone: c.sender_phone,
        sender_email: c.sender_email,
        message: c.message,
        read_at: c.read_at,
        created_at: c.created_at,
    }
}

#[tonic::async_trait]
impl ProfileContentRpc for ProfileContentGrpc {
    // ── Offers ──

    async fn create_offer(&self, req: Request<ProtoCreateOffer>) -> Result<Response<ProtoOffer>, Status> {
        let r = req.into_inner();
        let result = self.service.create_offer(&owner_of(&r.account_id, &r.organization_id), &newax_profile_content::CreateOfferRequest {
            title: r.title,
            description: r.description,
            valid_until: r.valid_until,
            is_active: r.is_active,
        }).await.map_err(to_status)?;
        Ok(Response::new(offer_to_proto(result)))
    }

    async fn list_my_offers(&self, req: Request<AccountIdRequest>) -> Result<Response<OfferListResponse>, Status> {
        let r = req.into_inner();
        let offers = self.service.list_my_offers(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(OfferListResponse {
            offers: offers.into_iter().map(offer_to_proto).collect(),
        }))
    }

    async fn update_offer(&self, req: Request<ProtoUpdateOffer>) -> Result<Response<ProtoOffer>, Status> {
        let r = req.into_inner();
        let result = self.service.update_offer(&owner_of(&r.account_id, &r.organization_id), &r.offer_id, &newax_profile_content::UpdateOfferRequest {
            title: r.title,
            description: r.description,
            valid_until: r.valid_until,
            is_active: r.is_active,
        }).await.map_err(to_status)?;
        Ok(Response::new(offer_to_proto(result)))
    }

    async fn remove_offer(&self, req: Request<RemoveOfferRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_offer(&owner_of(&r.account_id, &r.organization_id), &r.offer_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    // ── Business Hours ──

    async fn upsert_business_hour(&self, req: Request<UpsertBusinessHourRequest>) -> Result<Response<ProtoBusinessHour>, Status> {
        let r = req.into_inner();
        let result = self.service.upsert_business_hour(&owner_of(&r.account_id, &r.organization_id), &r.day, &newax_profile_content::UpsertBusinessHourRequest {
            open_minute: r.open_minute,
            close_minute: r.close_minute,
            is_closed: r.is_closed,
        }).await.map_err(to_status)?;
        Ok(Response::new(business_hour_to_proto(result)))
    }

    async fn list_my_business_hours(&self, req: Request<AccountIdRequest>) -> Result<Response<BusinessHourListResponse>, Status> {
        let r = req.into_inner();
        let hours = self.service.list_my_business_hours(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(BusinessHourListResponse {
            hours: hours.into_iter().map(business_hour_to_proto).collect(),
        }))
    }

    async fn remove_business_hour(&self, req: Request<RemoveBusinessHourRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_business_hour(&owner_of(&r.account_id, &r.organization_id), &r.day).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    // ── Custom Links ──

    async fn create_custom_link(&self, req: Request<ProtoCreateCustomLink>) -> Result<Response<ProtoCustomLink>, Status> {
        let r = req.into_inner();
        let result = self.service.create_custom_link(&owner_of(&r.account_id, &r.organization_id), &newax_profile_content::CreateCustomLinkRequest {
            label: r.label,
            url: r.url,
            order: r.order_idx,
        }).await.map_err(to_status)?;
        Ok(Response::new(custom_link_to_proto(result)))
    }

    async fn list_my_custom_links(&self, req: Request<AccountIdRequest>) -> Result<Response<CustomLinkListResponse>, Status> {
        let r = req.into_inner();
        let links = self.service.list_my_custom_links(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(CustomLinkListResponse {
            links: links.into_iter().map(custom_link_to_proto).collect(),
        }))
    }

    async fn remove_custom_link(&self, req: Request<RemoveCustomLinkRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_custom_link(&owner_of(&r.account_id, &r.organization_id), &r.link_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn update_custom_link(&self, req: Request<ProtoUpdateCustomLink>) -> Result<Response<ProtoCustomLink>, Status> {
        let r = req.into_inner();
        let result = self.service.update_custom_link(&owner_of(&r.account_id, &r.organization_id), &r.link_id, &newax_profile_content::UpdateCustomLinkRequest {
            label: r.label,
            url: r.url,
            order: r.order_idx,
        }).await.map_err(to_status)?;
        Ok(Response::new(custom_link_to_proto(result)))
    }

    // ── Social Links ──

    async fn create_social_link(&self, req: Request<ProtoCreateSocialLink>) -> Result<Response<ProtoSocialLink>, Status> {
        let r = req.into_inner();
        let result = self.service.create_social_link(&owner_of(&r.account_id, &r.organization_id), &newax_profile_content::CreateSocialLinkRequest {
            platform: r.platform,
            url: r.url,
            order: r.order_idx,
        }).await.map_err(to_status)?;
        Ok(Response::new(social_link_to_proto(result)))
    }

    async fn list_my_social_links(&self, req: Request<AccountIdRequest>) -> Result<Response<SocialLinkListResponse>, Status> {
        let r = req.into_inner();
        let links = self.service.list_my_social_links(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(SocialLinkListResponse {
            links: links.into_iter().map(social_link_to_proto).collect(),
        }))
    }

    async fn remove_social_link(&self, req: Request<RemoveSocialLinkRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_social_link(&owner_of(&r.account_id, &r.organization_id), &r.link_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    async fn update_social_link(&self, req: Request<ProtoUpdateSocialLink>) -> Result<Response<ProtoSocialLink>, Status> {
        let r = req.into_inner();
        let result = self.service.update_social_link(&owner_of(&r.account_id, &r.organization_id), &r.link_id, &newax_profile_content::UpdateSocialLinkRequest {
            platform: r.platform,
            url: r.url,
            order: r.order_idx,
        }).await.map_err(to_status)?;
        Ok(Response::new(social_link_to_proto(result)))
    }

    // ── Profile Images ──

    async fn upload_photo(&self, req: Request<UploadPhotoRequest>) -> Result<Response<ProtoProfileImage>, Status> {
        let r = req.into_inner();
        let result = self.service.upload_photo(&owner_of(&r.account_id, &r.organization_id), newax_profile_content::UploadedFile {
            content_type: r.content_type,
            data: r.data,
        }).await.map_err(to_status)?;
        Ok(Response::new(profile_image_to_proto(result)))
    }

    async fn upload_gallery_image(&self, req: Request<UploadGalleryImageRequest>) -> Result<Response<ProtoProfileImage>, Status> {
        let r = req.into_inner();
        let result = self.service.upload_gallery_image(&owner_of(&r.account_id, &r.organization_id), &r.kind, newax_profile_content::UploadedFile {
            content_type: r.content_type,
            data: r.data,
        }).await.map_err(to_status)?;
        Ok(Response::new(profile_image_to_proto(result)))
    }

    async fn list_my_images(&self, req: Request<AccountIdRequest>) -> Result<Response<ProfileImageListResponse>, Status> {
        let r = req.into_inner();
        let images = self.service.list_my_images(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(ProfileImageListResponse {
            images: images.into_iter().map(profile_image_to_proto).collect(),
        }))
    }

    async fn remove_image(&self, req: Request<RemoveImageRequest>) -> Result<Response<Empty>, Status> {
        let r = req.into_inner();
        self.service.remove_image(&owner_of(&r.account_id, &r.organization_id), &r.image_id).await.map_err(to_status)?;
        Ok(Response::new(Empty {}))
    }

    // ── Contact Messages ──

    async fn list_my_contact_messages(&self, req: Request<AccountIdRequest>) -> Result<Response<ContactMessageListResponse>, Status> {
        let r = req.into_inner();
        let messages = self.service.list_my_contact_messages(&owner_of(&r.account_id, &r.organization_id)).await.map_err(to_status)?;
        Ok(Response::new(ContactMessageListResponse {
            messages: messages.into_iter().map(contact_message_to_proto).collect(),
        }))
    }

    async fn mark_contact_message_read(&self, req: Request<MarkContactMessageReadRequest>) -> Result<Response<ProtoContactMessage>, Status> {
        let r = req.into_inner();
        let result = self.service.mark_contact_message_read(&owner_of(&r.account_id, &r.organization_id), &r.message_id).await.map_err(to_status)?;
        Ok(Response::new(contact_message_to_proto(result)))
    }

    // ── Public endpoints ──

    async fn list_public_offers(&self, req: Request<SlugRequest>) -> Result<Response<OfferListResponse>, Status> {
        let r = req.into_inner();
        let offers = self.service.list_public_offers(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(OfferListResponse {
            offers: offers.into_iter().map(offer_to_proto).collect(),
        }))
    }

    async fn list_public_business_hours(&self, req: Request<SlugRequest>) -> Result<Response<BusinessHourListResponse>, Status> {
        let r = req.into_inner();
        let hours = self.service.list_public_business_hours(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(BusinessHourListResponse {
            hours: hours.into_iter().map(business_hour_to_proto).collect(),
        }))
    }

    async fn list_public_links(&self, req: Request<SlugRequest>) -> Result<Response<PublicLinksResponse>, Status> {
        let r = req.into_inner();
        let (custom, social) = self.service.list_public_links(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(PublicLinksResponse {
            custom_links: custom.into_iter().map(custom_link_to_proto).collect(),
            social_links: social.into_iter().map(social_link_to_proto).collect(),
        }))
    }

    async fn create_public_contact_message(&self, req: Request<CreatePublicContactMessageRequest>) -> Result<Response<ProtoContactMessage>, Status> {
        let r = req.into_inner();
        let result = self.service.create_public_contact_message(&r.slug, &newax_profile_content::CreateContactMessageRequest {
            sender_name: r.sender_name,
            sender_phone: r.sender_phone,
            sender_email: r.sender_email,
            message: r.message,
        }).await.map_err(to_status)?;
        Ok(Response::new(contact_message_to_proto(result)))
    }

    async fn list_public_images(&self, req: Request<SlugRequest>) -> Result<Response<ProfileImageListResponse>, Status> {
        let r = req.into_inner();
        let images = self.service.list_public_images(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(ProfileImageListResponse {
            images: images.into_iter().map(profile_image_to_proto).collect(),
        }))
    }

    async fn get_public_photo(&self, req: Request<SlugRequest>) -> Result<Response<ImageUrlResponse>, Status> {
        let r = req.into_inner();
        let (url, content_type) = self.service.get_public_photo(&r.slug).await.map_err(to_status)?;
        Ok(Response::new(ImageUrlResponse { url, content_type }))
    }

    async fn get_public_image(&self, req: Request<GetPublicImageRequest>) -> Result<Response<ImageUrlResponse>, Status> {
        let r = req.into_inner();
        let (url, content_type) = self.service.get_public_image(&r.slug, &r.image_id).await.map_err(to_status)?;
        Ok(Response::new(ImageUrlResponse { url, content_type }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_profile_content=debug").unwrap())
        .init();

    // Never fall back to the superuser DATABASE_URL: it bypasses RLS.
    let database_url = std::env::var("APP_DATABASE_URL")
        .map_err(|_| "APP_DATABASE_URL must be set")?;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url).await?;

    let port: u16 = std::env::var("PROFILE_CONTENT_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(50090);
    // Plaintext, unauthenticated gRPC: loopback by default. Set BIND_ADDR
    // only on a private network that already enforces access control.
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{bind}:{port}").parse()?;

    let grpc = ProfileContentGrpc { service: ProfileContentService::new(pool).with_storage(std::sync::Arc::new(
            nid_storage::LocalStorageDriver::new(
                std::env::var("LOCAL_STORAGE_DIR").map_err(|_| "LOCAL_STORAGE_DIR must be set")?,
            ),
        )) };

    info!(port, "svc-profile-content starting (gRPC)");
    nid_service_auth::server_builder()?
        .add_service(ProfileContentApiServiceServer::with_interceptor(grpc, nid_service_auth::ServerAuth::from_env(&bind)?))
        .serve(addr)
        .await?;
    Ok(())
}
