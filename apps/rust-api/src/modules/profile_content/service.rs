//! Profile content service — gRPC client for `svc-profile-content`.
//!
//! Business logic moved to `crates/profile_content`, served by
//! `services/profile-content` on port 50090. This file is the thin
//! gRPC client replacing the local implementation.

use anyhow::Result;

use crate::core::upload::UploadedFile;
use crate::modules::profile_content::dto::{
    BusinessHourResponse, ContactMessageResponse, CreateContactMessageRequest,
    CreateCustomLinkRequest, CreateOfferRequest, CreateSocialLinkRequest,
    CustomLinkResponse, MessageResponse, OfferResponse, ProfileImageResponse,
    SocialLinkResponse, UpdateCustomLinkRequest, UpdateOfferRequest,
    UpdateSocialLinkRequest, UpsertBusinessHourRequest,
};

pub use crate::modules::profile_content::service::inner::ProfileContentService;

mod inner {
    use anyhow::{anyhow, Result};
    use newax_proto::profile_content::v1::{
        profile_content_api_service_client::ProfileContentApiServiceClient,
        AccountIdRequest, BusinessHourListResponse, BusinessHourResponse as ProtoBusinessHour,
        ContactMessageListResponse, ContactMessageResponse as ProtoContactMessage,
        CreateCustomLinkRequest as GrpcCreateCustomLink,
        CreateOfferRequest as GrpcCreateOffer,
        CreatePublicContactMessageRequest,
        CreateSocialLinkRequest as GrpcCreateSocialLink,
        CustomLinkListResponse, CustomLinkResponse as ProtoCustomLink,
        GetPublicImageRequest, ImageUrlResponse,
        MarkContactMessageReadRequest, OfferListResponse, OfferResponse as ProtoOffer,
        ProfileImageListResponse, ProfileImageResponse as ProtoProfileImage,
        PublicLinksResponse, RemoveBusinessHourRequest, RemoveCustomLinkRequest,
        RemoveImageRequest, RemoveOfferRequest, RemoveSocialLinkRequest,
        SocialLinkListResponse, SocialLinkResponse as ProtoSocialLink,
        SlugRequest, UpdateCustomLinkRequest as GrpcUpdateCustomLink,
        UpdateOfferRequest as GrpcUpdateOffer,
        UpdateSocialLinkRequest as GrpcUpdateSocialLink,
        UploadGalleryImageRequest, UploadPhotoRequest,
        UpsertBusinessHourRequest as GrpcUpsertBusinessHour,
    };
    use tonic::transport::Channel;
    
    use super::{
        BusinessHourResponse, ContactMessageResponse, CreateContactMessageRequest,
        CreateCustomLinkRequest, CreateOfferRequest, CreateSocialLinkRequest,
        CustomLinkResponse, OfferResponse, ProfileImageResponse,
        SocialLinkResponse, UpdateCustomLinkRequest, UpdateOfferRequest,
        UpdateSocialLinkRequest, UpsertBusinessHourRequest,
    };
    use crate::core::upload::UploadedFile;

    async fn client() -> Result<ProfileContentApiServiceClient<tonic::transport::Channel>> {
        let url = std::env::var("PROFILE_CONTENT_SERVICE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:50090".to_string());
        ProfileContentApiServiceClient::connect(url)
            .await
            .map_err(|e| anyhow!("profile-content service unreachable: {e}"))
    }

    fn offer_from_proto(p: ProtoOffer) -> OfferResponse {
        OfferResponse {
            id: p.id,
            profile_id: p.profile_id,
            title: p.title,
            price_minor: p.price_minor,
            currency: p.currency,
            description: p.description,
            is_active: p.is_active,
        }
    }

    fn business_hour_from_proto(p: ProtoBusinessHour) -> BusinessHourResponse {
        BusinessHourResponse {
            id: p.id,
            profile_id: p.profile_id,
            weekday: p.weekday,
            start_time: p.start_time,
            end_time: p.end_time,
            is_closed: p.is_closed,
        }
    }

    fn custom_link_from_proto(p: ProtoCustomLink) -> CustomLinkResponse {
        CustomLinkResponse {
            id: p.id,
            profile_id: p.profile_id,
            label: p.label,
            url: p.url,
            order: p.order_idx,
        }
    }

    fn social_link_from_proto(p: ProtoSocialLink) -> SocialLinkResponse {
        SocialLinkResponse {
            id: p.id,
            profile_id: p.profile_id,
            platform: p.platform,
            username: p.username,
            url: p.url,
        }
    }

    fn profile_image_from_proto(p: ProtoProfileImage) -> ProfileImageResponse {
        ProfileImageResponse {
            id: p.id,
            profile_id: p.profile_id,
            kind: p.kind,
            url: p.url,
            content_type: p.content_type,
            created_at: p.created_at,
        }
    }

    fn contact_message_from_proto(p: ProtoContactMessage) -> ContactMessageResponse {
        ContactMessageResponse {
            id: p.id,
            profile_id: p.profile_id,
            name: p.name,
            email: p.email,
            message: p.message,
            is_read: p.is_read,
            created_at: p.created_at,
        }
    }

    pub struct ProfileContentService;

    impl ProfileContentService {
        // ── Offers ──

        pub async fn create_offer(
            &self,
            account_id: &str,
            req: &CreateOfferRequest,
        ) -> Result<OfferResponse> {
            let mut c = client().await?;
            let resp = c.create_offer(GrpcCreateOffer {
                account_id: account_id.to_string(),
                title: req.title.clone(),
                price_minor: req.price_minor,
                currency: req.currency.clone(),
                description: req.description.clone(),
            }).await?.into_inner();
            Ok(offer_from_proto(resp))
        }

        pub async fn list_my_offers(&self, account_id: &str) -> Result<Vec<OfferResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_offers(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.offers.into_iter().map(offer_from_proto).collect())
        }

        pub async fn update_offer(
            &self,
            account_id: &str,
            offer_id: &str,
            req: &UpdateOfferRequest,
        ) -> Result<OfferResponse> {
            let mut c = client().await?;
            let resp = c.update_offer(GrpcUpdateOffer {
                account_id: account_id.to_string(),
                offer_id: offer_id.to_string(),
                title: req.title.clone(),
                price_minor: req.price_minor,
                is_active: req.is_active,
            }).await?.into_inner();
            Ok(offer_from_proto(resp))
        }

        pub async fn remove_offer(&self, account_id: &str, offer_id: &str) -> Result<()> {
            let mut c = client().await?;
            c.remove_offer(RemoveOfferRequest {
                account_id: account_id.to_string(),
                offer_id: offer_id.to_string(),
            }).await?;
            Ok(())
        }

        // ── Business Hours ──

        pub async fn upsert_business_hour(
            &self,
            account_id: &str,
            day: &str,
            req: &UpsertBusinessHourRequest,
        ) -> Result<BusinessHourResponse> {
            let mut c = client().await?;
            let resp = c.upsert_business_hour(GrpcUpsertBusinessHour {
                account_id: account_id.to_string(),
                day: day.to_string(),
                start_time: req.start_time.clone(),
                end_time: req.end_time.clone(),
                is_closed: req.is_closed,
            }).await?.into_inner();
            Ok(business_hour_from_proto(resp))
        }

        pub async fn list_my_business_hours(&self, account_id: &str) -> Result<Vec<BusinessHourResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_business_hours(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.hours.into_iter().map(business_hour_from_proto).collect())
        }

        pub async fn remove_business_hour(&self, account_id: &str, day: &str) -> Result<()> {
            let mut c = client().await?;
            c.remove_business_hour(RemoveBusinessHourRequest {
                account_id: account_id.to_string(),
                day: day.to_string(),
            }).await?;
            Ok(())
        }

        // ── Custom Links ──

        pub async fn create_custom_link(
            &self,
            account_id: &str,
            req: &CreateCustomLinkRequest,
        ) -> Result<CustomLinkResponse> {
            let mut c = client().await?;
            let resp = c.create_custom_link(GrpcCreateCustomLink {
                account_id: account_id.to_string(),
                label: req.label.clone(),
                url: req.url.clone(),
                order_idx: req.order.unwrap_or(0),
            }).await?.into_inner();
            Ok(custom_link_from_proto(resp))
        }

        pub async fn list_my_custom_links(&self, account_id: &str) -> Result<Vec<CustomLinkResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_custom_links(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.links.into_iter().map(custom_link_from_proto).collect())
        }

        pub async fn remove_custom_link(&self, account_id: &str, link_id: &str) -> Result<()> {
            let mut c = client().await?;
            c.remove_custom_link(RemoveCustomLinkRequest {
                account_id: account_id.to_string(),
                link_id: link_id.to_string(),
            }).await?;
            Ok(())
        }

        pub async fn update_custom_link(
            &self,
            account_id: &str,
            link_id: &str,
            req: &UpdateCustomLinkRequest,
        ) -> Result<CustomLinkResponse> {
            let mut c = client().await?;
            let resp = c.update_custom_link(GrpcUpdateCustomLink {
                account_id: account_id.to_string(),
                link_id: link_id.to_string(),
                label: req.label.clone(),
                url: req.url.clone(),
                order_idx: req.order.unwrap_or(0),
            }).await?.into_inner();
            Ok(custom_link_from_proto(resp))
        }

        // ── Social Links ──

        pub async fn create_social_link(
            &self,
            account_id: &str,
            req: &CreateSocialLinkRequest,
        ) -> Result<SocialLinkResponse> {
            let mut c = client().await?;
            let resp = c.create_social_link(GrpcCreateSocialLink {
                account_id: account_id.to_string(),
                platform: req.platform.clone(),
                username: req.username.clone(),
                url: req.url.clone(),
            }).await?.into_inner();
            Ok(social_link_from_proto(resp))
        }

        pub async fn list_my_social_links(&self, account_id: &str) -> Result<Vec<SocialLinkResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_social_links(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.links.into_iter().map(social_link_from_proto).collect())
        }

        pub async fn remove_social_link(&self, account_id: &str, link_id: &str) -> Result<()> {
            let mut c = client().await?;
            c.remove_social_link(RemoveSocialLinkRequest {
                account_id: account_id.to_string(),
                link_id: link_id.to_string(),
            }).await?;
            Ok(())
        }

        pub async fn update_social_link(
            &self,
            account_id: &str,
            link_id: &str,
            req: &UpdateSocialLinkRequest,
        ) -> Result<SocialLinkResponse> {
            let mut c = client().await?;
            let resp = c.update_social_link(GrpcUpdateSocialLink {
                account_id: account_id.to_string(),
                link_id: link_id.to_string(),
                platform: req.platform.clone(),
                username: req.username.clone(),
                url: req.url.clone(),
            }).await?.into_inner();
            Ok(social_link_from_proto(resp))
        }

        // ── Profile Images ──

        pub async fn upload_photo(
            &self,
            account_id: &str,
            file: UploadedFile,
        ) -> Result<ProfileImageResponse> {
            let mut c = client().await?;
            let resp = c.upload_photo(UploadPhotoRequest {
                account_id: account_id.to_string(),
                content_type: file.content_type,
                data: file.buffer,
            }).await?.into_inner();
            Ok(profile_image_from_proto(resp))
        }

        pub async fn upload_gallery_image(
            &self,
            account_id: &str,
            kind: &str,
            file: UploadedFile,
        ) -> Result<ProfileImageResponse> {
            let mut c = client().await?;
            let resp = c.upload_gallery_image(UploadGalleryImageRequest {
                account_id: account_id.to_string(),
                kind: kind.to_string(),
                content_type: file.content_type,
                data: file.buffer,
            }).await?.into_inner();
            Ok(profile_image_from_proto(resp))
        }

        pub async fn list_my_images(&self, account_id: &str) -> Result<Vec<ProfileImageResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_images(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.images.into_iter().map(profile_image_from_proto).collect())
        }

        pub async fn remove_image(&self, account_id: &str, image_id: &str) -> Result<()> {
            let mut c = client().await?;
            c.remove_image(RemoveImageRequest {
                account_id: account_id.to_string(),
                image_id: image_id.to_string(),
            }).await?;
            Ok(())
        }

        pub async fn list_public_images(&self, slug: &str) -> Result<Vec<ProfileImageResponse>> {
            let mut c = client().await?;
            let resp = c.list_public_images(SlugRequest {
                slug: slug.to_string(),
            }).await?.into_inner();
            Ok(resp.images.into_iter().map(profile_image_from_proto).collect())
        }

        // ── Contact Messages ──

        pub async fn list_my_contact_messages(&self, account_id: &str) -> Result<Vec<ContactMessageResponse>> {
            let mut c = client().await?;
            let resp = c.list_my_contact_messages(AccountIdRequest {
                account_id: account_id.to_string(),
            }).await?.into_inner();
            Ok(resp.messages.into_iter().map(contact_message_from_proto).collect())
        }

        pub async fn mark_contact_message_read(&self, account_id: &str, message_id: &str) -> Result<ContactMessageResponse> {
            let mut c = client().await?;
            let resp = c.mark_contact_message_read(MarkContactMessageReadRequest {
                account_id: account_id.to_string(),
                message_id: message_id.to_string(),
            }).await?.into_inner();
            Ok(contact_message_from_proto(resp))
        }

        pub async fn create_public_contact_message(
            &self,
            slug: &str,
            req: &CreateContactMessageRequest,
        ) -> Result<ContactMessageResponse> {
            let mut c = client().await?;
            let resp = c.create_public_contact_message(CreatePublicContactMessageRequest {
                slug: slug.to_string(),
                name: req.name.clone(),
                email: req.email.clone(),
                message: req.message.clone(),
            }).await?.into_inner();
            Ok(contact_message_from_proto(resp))
        }

        // ── Public endpoints ──

        pub async fn list_public_offers(&self, slug: &str) -> Result<Vec<OfferResponse>> {
            let mut c = client().await?;
            let resp = c.list_public_offers(SlugRequest {
                slug: slug.to_string(),
            }).await?.into_inner();
            Ok(resp.offers.into_iter().map(offer_from_proto).collect())
        }

        pub async fn list_public_business_hours(&self, slug: &str) -> Result<Vec<BusinessHourResponse>> {
            let mut c = client().await?;
            let resp = c.list_public_business_hours(SlugRequest {
                slug: slug.to_string(),
            }).await?.into_inner();
            Ok(resp.hours.into_iter().map(business_hour_from_proto).collect())
        }

        pub async fn list_public_links(&self, slug: &str) -> Result<(Vec<CustomLinkResponse>, Vec<SocialLinkResponse>)> {
            let mut c = client().await?;
            let resp = c.list_public_links(SlugRequest {
                slug: slug.to_string(),
            }).await?.into_inner();
            let custom = resp.custom_links.into_iter().map(custom_link_from_proto).collect();
            let social = resp.social_links.into_iter().map(social_link_from_proto).collect();
            Ok((custom, social))
        }

        pub async fn get_public_photo(&self, slug: &str) -> Result<(String, String)> {
            let mut c = client().await?;
            let resp = c.get_public_photo(SlugRequest {
                slug: slug.to_string(),
            }).await?.into_inner();
            Ok((resp.url, resp.content_type))
        }

        pub async fn get_public_image(&self, slug: &str, image_id: &str) -> Result<(String, String)> {
            let mut c = client().await?;
            let resp = c.get_public_image(GetPublicImageRequest {
                slug: slug.to_string(),
                image_id: image_id.to_string(),
            }).await?.into_inner();
            Ok((resp.url, resp.content_type))
        }
    }
}
