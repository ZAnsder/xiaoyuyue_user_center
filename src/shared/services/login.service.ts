import * as _ from 'lodash';

import { AuthenticateModel, AuthenticateResultModel, ExternalAuthenticateModel, ExternalAuthenticateResultModel, ExternalLoginProviderInfoModel, TokenAuthServiceProxy, WebLogServiceProxy } from '@shared/service-proxies/service-proxies';
import { Headers, Http, Response } from '@angular/http';
import { Injectable, transition } from '@angular/core';
import { Params, Router } from '@angular/router';

import { AppConsts } from '@shared/AppConsts';
import { CookiesService } from 'shared/services/cookies.service';
import { LogService } from '@abp/log/log.service';
import { MessageService } from '@abp/message/message.service';
import { UrlHelper } from '@shared/helpers/UrlHelper';

declare const FB: any; // Facebook API
declare const gapi: any; // Facebook API
declare const WL: any; // Microsoft API

export class ExternalLoginProvider extends ExternalLoginProviderInfoModel {

    static readonly FACEBOOK = 'Facebook';
    static readonly GOOGLE = 'Google';
    static readonly MICROSOFT = 'Microsoft';
    static readonly WECHAT = 'WeChat';
    static readonly WECHATMP = 'WeChatMP';

    icon: string;
    initialized = false;

    private static getSocialIcon(providerName: string): string {
        providerName = providerName.toLowerCase();

        if (providerName === 'google') {
            providerName = 'googleplus';
        }

        return providerName;
    }

    constructor(providerInfo: ExternalLoginProviderInfoModel) {
        super();

        this.name = providerInfo.name;
        this.clientId = providerInfo.clientId;
        this.icon = ExternalLoginProvider.getSocialIcon(this.name);
        this.initialized = providerInfo.name === 'WeChat';
    }
}

@Injectable()
export class LoginService {
    static readonly twoFactorRememberClientTokenName = 'TwoFactorRememberClientToken';

    throwException: any;
    jsonParseReviver: any;
    authenticateModel: AuthenticateModel;
    authenticateResult: AuthenticateResultModel;
    externalLoginProviders: ExternalLoginProvider[] = [];
    rememberMe: boolean;

    constructor(
        private _tokenAuthService: TokenAuthServiceProxy,
        private _router: Router,
        private _messageService: MessageService,
        private _logService: LogService,
        private _cookiesService: CookiesService
    ) {
        this.clear();
    }

    authenticate(finallyCallback?: () => void, redirectUrl?: string): void {
        finallyCallback = finallyCallback || (() => { });

        // We may switch to localStorage instead of cookies
        this.authenticateModel.twoFactorRememberClientToken = this._cookiesService.getCookieValue(LoginService.twoFactorRememberClientTokenName);

        this._tokenAuthService
            .authenticate(this.authenticateModel)
            .finally(finallyCallback)
            .subscribe((result: AuthenticateResultModel) => {
                this.processAuthenticateResult(result, redirectUrl);
            });
    }

    externalAuthenticate(provider: ExternalLoginProvider): void {
        this.ensureExternalLoginProviderInitialized(provider, () => {
            if (provider.name === ExternalLoginProvider.FACEBOOK) {
                FB.login();
            } else if (provider.name === ExternalLoginProvider.GOOGLE) {
                gapi.auth2.getAuthInstance().signIn();
            } else if (provider.name === ExternalLoginProvider.MICROSOFT) {
                WL.login({
                    scope: ['wl.signin', 'wl.basic', 'wl.emails']
                });
            } else if (provider.name === ExternalLoginProvider.WECHAT) {
                jQuery.getScript('http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js', () => {
                    const wxLogin = new WxLogin({
                        id: 'external_login_container',
                        appid: provider.clientId,
                        scope: 'snsapi_login',
                        redirect_uri: AppConsts.appBaseUrl + AppConsts.externalLoginUrl + '?providerName=' + ExternalLoginProvider.WECHAT, /*暂用测试域名*/
                        state: 'xiaoyuyue',
                        style: 'black',
                        href: 'https://static.vapps.com.cn/vappszero/wechat-login.css'
                    });
                });
            }
        });
    }

    init(callback?: any): void {
        this.initExternalLoginProviders(callback);
    }

    private processAuthenticateResult(authenticateResult: AuthenticateResultModel, redirectUrl?: string) {
        this.authenticateResult = authenticateResult;

        if (authenticateResult.shouldResetPassword) {
            // Password reset

            this._router.navigate(['account/reset-password'], {
                queryParams: {
                    userId: authenticateResult.userId,
                    tenantId: abp.session.tenantId,
                    resetCode: authenticateResult.passwordResetCode
                }
            });

            this.clear();

        } else if (authenticateResult.requiresTwoFactorVerification) {
            // Two factor authentication

            this._router.navigate(['account/send-code']);

        } else if (authenticateResult.accessToken) {
            // Successfully logged in
            // this._cookiesService.getCookieValue('UrlHelper.redirectUrl');
            this.login(authenticateResult.tenantId, authenticateResult.accessToken, authenticateResult.encryptedAccessToken, authenticateResult.expireInSeconds, this.rememberMe, authenticateResult.twoFactorRememberClientToken, UrlHelper.redirectUrl);

        } else {
            // Unexpected result!

            this._logService.warn('Unexpected authenticateResult!');
            this._router.navigate(['auth/login']);

        }
    }

    private login(tenantId: number, accessToken: string, encryptedAccessToken: string, expireInSeconds: number, rememberMe?: boolean, twoFactorRememberClientToken?: string, redirectUrl?: string): void {
        const tokenExpireDate = rememberMe ? (new Date(new Date().getTime() + 1000 * expireInSeconds)) : undefined;

        this._cookiesService.setToken(
            accessToken,
            tokenExpireDate
        );
        this._cookiesService.setTenantIdCookie(tenantId);

        this._cookiesService.setCookieValue(
            AppConsts.authorization.encrptedAuthTokenName,
            encryptedAccessToken,
            tokenExpireDate,
            abp.appPath
        );

        if (twoFactorRememberClientToken) {
            this._cookiesService.setCookieValue(
                LoginService.twoFactorRememberClientTokenName,
                twoFactorRememberClientToken,
                new Date(new Date().getTime() + 365 * 86400000), // 1 year
                abp.appPath
            );
        }

        UrlHelper.redirectUrl = this._cookiesService.getCookieValue('UrlHelper.redirectUrl');
        this._cookiesService.deleteCookie('UrlHelper.redirectUrl', '/');
        const initialUrl = UrlHelper.redirectUrl ? UrlHelper.redirectUrl : UrlHelper.redirectUrl = AppConsts.appBaseUrl + '/user/home';
        if (redirectUrl) {
            location.href = redirectUrl;
        } else {
            location.href = initialUrl;
        }
    }

    private clear(): void {
        this.authenticateModel = new AuthenticateModel();
        this.authenticateModel.rememberClient = false;
        this.authenticateResult = null;
        this.rememberMe = false;
    }

    private initExternalLoginProviders(callback?: any) {
        if (this.externalLoginProviders.length > 0) {
            return;
        }
        this._tokenAuthService
            .getExternalAuthenticationProviders()
            .subscribe((providers: ExternalLoginProviderInfoModel[]) => {
                this.externalLoginProviders = _.map(providers, p => {
                    return new ExternalLoginProvider(p);
                });

                if (callback) {
                    callback(this.externalLoginProviders);
                }
            });
    }

    ensureExternalLoginProviderInitialized(loginProvider: ExternalLoginProvider, callback: () => void) {
        if (loginProvider.initialized) {
            callback();
            return;
        }

        if (loginProvider.name === ExternalLoginProvider.FACEBOOK) {
            jQuery.getScript('//connect.facebook.net/en_US/sdk.js', () => {
                FB.init({
                    appId: loginProvider.clientId,
                    cookie: false,
                    xfbml: true,
                    version: 'v2.5'
                });

                FB.getLoginStatus(response => {
                    this.facebookLoginStatusChangeCallback(response);
                });

                callback();
            });
        } else if (loginProvider.name === ExternalLoginProvider.GOOGLE) {
            jQuery.getScript('https://apis.google.com/js/api.js', () => {
                gapi.load('client:auth2',
                    () => {
                        gapi.client.init({
                            clientId: loginProvider.clientId,
                            scope: 'openid profile email'
                        }).then(() => {
                            gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
                                this.googleLoginStatusChangeCallback(isSignedIn);
                            });

                            this.googleLoginStatusChangeCallback(gapi.auth2.getAuthInstance().isSignedIn.get());
                        });

                        callback();
                    });
            });
        } else if (loginProvider.name === ExternalLoginProvider.MICROSOFT) {
            jQuery.getScript('//js.live.net/v5.0/wl.js', () => {
                WL.Event.subscribe('auth.login', this.microsoftLogin);
                WL.init({
                    client_id: loginProvider.clientId,
                    scope: ['wl.signin', 'wl.basic', 'wl.emails'],
                    redirect_uri: AppConsts.appBaseUrl,
                    response_type: 'token'
                });
            });
        } else if (loginProvider.name === ExternalLoginProvider.WECHAT) {

        }
    }

    public externalLoginCallback(params: Params): void {
        this.wechatLogin(params);
    }

    private facebookLoginStatusChangeCallback(resp) {
        if (resp.status === 'connected') {
            const model = new ExternalAuthenticateModel();
            model.authProvider = ExternalLoginProvider.FACEBOOK;
            model.providerAccessCode = resp.authResponse.accessToken;
            model.providerKey = resp.authResponse.userID;
            this._tokenAuthService.externalAuthenticate(model)
                .subscribe((result: ExternalAuthenticateResultModel) => {
                    if (result.waitingForActivation) {
                        this._messageService.info('您已成功注册,请完善基本信息!');
                        return;
                    }

                    // this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
                });
        }
    }

    private googleLoginStatusChangeCallback(isSignedIn) {
        if (isSignedIn) {
            const model = new ExternalAuthenticateModel();
            model.authProvider = ExternalLoginProvider.GOOGLE;
            model.providerAccessCode = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            model.providerKey = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getId();
            this._tokenAuthService.externalAuthenticate(model)
                .subscribe((result: ExternalAuthenticateResultModel) => {
                    if (result.waitingForActivation) {
                        this._messageService.info('您已成功注册,请完善基本信息!');
                        return;
                    }

                    // this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
                });
        }
    }

    private wechatLogin(params: Params) {
        const model = new ExternalAuthenticateModel();
        model.authProvider = params['providerName'];
        model.providerAccessCode = params['code'];
        model.providerKey = params['code'];
        this.externalAuthenticateAsync(model).done((result: ExternalAuthenticateResultModel) => {
            if (result.waitingForActivation) {
                this._messageService.info('您已成功注册,请完善基本信息!');
                // this._router.navigate(['/account/supplementary-external-register', result.userId]);
                return;
            }

            this.login(result.tenantId, result.accessToken, result.encryptedAccessToken, result.expireInSeconds, true);
        });
    }

    /**
    * Microsoft login is not completed yet, because of an error thrown by zone.js: https://github.com/angular/zone.js/issues/290
    */
    private microsoftLogin() {
        this._logService.debug(WL.getSession());
        const model = new ExternalAuthenticateModel();
        model.authProvider = ExternalLoginProvider.MICROSOFT;
        model.providerAccessCode = WL.getSession().access_token;
        model.providerKey = WL.getSession().id; // How to get id?
        this._tokenAuthService.externalAuthenticate(model)
            .subscribe((result: ExternalAuthenticateResultModel) => {
                if (result.waitingForActivation) {
                    this._messageService.info('您已成功注册,请完善基本信息!');
                    return;
                }

                // this.login(result.accessToken, result.encryptedAccessToken, result.expireInSeconds);
            });
    }

    /**
    * @return Success
    */
    externalAuthenticateAsync(model: ExternalAuthenticateModel): JQueryPromise<ExternalAuthenticateResultModel> {
        let url_ = AppConsts.remoteServiceBaseUrl + '/api/TokenAuth/ExternalAuthenticate';
        url_ = url_.replace(/[?&]$/, '');

        const content_ = JSON.stringify(model ? model.toJSON() : null);

        // let options_ = {
        //     body: content_,
        //     method: "post",
        //     headers: new Headers({
        //         "Content-Type": "application/json; charset=UTF-8",
        //         "Accept": "application/json; charset=UTF-8"
        //     })
        // };
        const defer = $.Deferred();

        return abp.ajax({
            url: url_,
            method: 'POST',
            data: content_,
            async: false,
            headers: {
                'Accept-Language': abp.utils.getCookieValue('Abp.Localization.CultureName'),
                'Abp.TenantId': abp.multiTenancy.getTenantIdCookie()
                // "Content-Type": "application/json; charset=UTF-8",
                // "Accept": "application/json; charset=UTF-8"
            }
        }).done(response => {
            return response;
        });
    }

    protected processExternalAuthenticate(response: Response): ExternalAuthenticateResultModel {
        const responseText = response.text();
        const status = response.status;

        if (status === 200) {
            let result200: ExternalAuthenticateResultModel = null;
            const resultData200 = responseText === '' ? null : JSON.parse(responseText, this.jsonParseReviver);
            result200 = resultData200 ? ExternalAuthenticateResultModel.fromJS(resultData200) : new ExternalAuthenticateResultModel();
            return result200;
        } else if (status !== 200 && status !== 204) {
            this.throwException('An unexpected server error occurred.', status, responseText);
        }
        return null;
    }


}