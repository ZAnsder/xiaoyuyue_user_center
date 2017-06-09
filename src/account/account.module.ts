import * as ngCommon from '@angular/common';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule, JsonpModule } from '@angular/http';
import { ModalModule } from 'ngx-bootstrap/modal';

import { AbpModule } from '@abp/abp.module';

import { AccountRoutingModule } from './account-routing.module';

import { ServiceProxyModule } from '@shared/service-proxies/service-proxy.module';

import { AppConsts } from '@shared/AppConsts';
import { UtilsModule } from '@shared/utils/utils.module';
import { CommonModule } from '@shared/common/common.module';

import { AccountComponent } from './account.component';
import { TenantChangeComponent } from './shared/tenant-change.component';
import { TenantChangeModalComponent } from './shared/tenant-change-modal.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { RegisterTenantComponent } from './register/register-tenant.component';
import { RegisterTenantResultComponent } from './register/register-tenant-result.component';
import { TenantRegistrationHelperService } from './register/tenant-registration-helper.service';
import { ForgotPasswordComponent } from './password/forgot-password.component';
import { ResetPasswordComponent } from './password/reset-password.component';
import { EmailActivationComponent } from './email-activation/email-activation.component';
import { ConfirmEmailComponent } from './email-activation/confirm-email.component';
import { SendTwoFactorCodeComponent } from './login/send-two-factor-code.component';
import { ValidateTwoFactorCodeComponent } from './login/validate-two-factor-code.component';
import { LanguageSwitchComponent } from './language-switch.component';
import { LoginService } from "shared/services/login.service";
import { TooltipModule } from "ngx-bootstrap";
import { SupplementaryExternalRegisterComponent } from "account/supplementary-external-register/supplementary-external-register.component";
import { LuosimaoCaptcha } from "account/shared/luosimao-captcha/luosimao-captcha.component";
import { PhoneValidateComponent } from "account/shared/phone-validate/phone-validate.component";
import { SMSServiceProxy } from "shared/service-proxies/service-proxies";
import { BackgroundImgComponent } from "account/background-img/background-img.component";
import { HeaderComponent } from "account/header/header.component";
import { FooterComponent } from "account/footer/footer.component";

@NgModule({
    imports: [
        ngCommon.CommonModule,
        FormsModule,
        HttpModule,
        JsonpModule,

        ModalModule.forRoot(),
        TooltipModule.forRoot(),

        AbpModule,

        CommonModule,

        UtilsModule,
        ServiceProxyModule,
        AccountRoutingModule
    ],
    declarations: [
        AccountComponent,
        TenantChangeComponent,
        TenantChangeModalComponent,
        LoginComponent,
        RegisterComponent,
        RegisterTenantComponent,
        RegisterTenantResultComponent,
        ForgotPasswordComponent,
        ResetPasswordComponent,
        EmailActivationComponent,
        ConfirmEmailComponent,
        SendTwoFactorCodeComponent,
        ValidateTwoFactorCodeComponent,
        LanguageSwitchComponent,
        SupplementaryExternalRegisterComponent,
        PhoneValidateComponent,
        LuosimaoCaptcha,
        
        HeaderComponent,
        FooterComponent,
        BackgroundImgComponent
    ],
    providers: [
        LoginService,
        TenantRegistrationHelperService,
        SMSServiceProxy,
        TooltipModule
    ]
})
export class AccountModule {

}