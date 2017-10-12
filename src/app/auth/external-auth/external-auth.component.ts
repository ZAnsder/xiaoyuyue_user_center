import * as _ from 'lodash';

import { ActivatedRoute, Params, Router } from '@angular/router';
import { Component, OnInit, transition } from '@angular/core';
import { ExternalLoginProvider, LoginService } from 'shared/services/login.service';
import { ExternalLoginProviderInfoModel, TokenAuthServiceProxy } from '@shared/service-proxies/service-proxies';

import { AppConsts } from '@shared/AppConsts';
import { CookiesService } from './../../../shared/services/cookies.service';
import { element } from 'protractor';

@Component({
    selector: 'xiaoyuyue-loading',
    templateUrl: './external-auth.component.html',
    styleUrls: ['./external-auth.component.scss']
})
export class ExternalAuthComponent implements OnInit {

    isAuthBind: boolean;

    constructor(
        private _router: Router,
        private _loginService: LoginService,
        private _activatedRoute: ActivatedRoute,
        private _tokenAuthService: TokenAuthServiceProxy,
        private _cookiesService: CookiesService
    ) { }

    ngOnInit() {
        this.externalLogin();
    }

    externalLogin(): void {
        this._activatedRoute.queryParams.subscribe((params: Params) => {

            if (params['redirectUrl'] !== undefined) {
                this._cookiesService.setCookieValue('UrlHelper.redirectUrl', params['redirectUrl'], null, '/');
            }

            if (params['authToken'] !== undefined) {
                this._cookiesService.setToken(params['authToken']);
            }

            if (params['isAuthBind'] !== undefined) {
                this.isAuthBind = params['isAuthBind'];
            }

            if (params['providerName'] !== undefined) {
                if (!this.isAuthBind) {
                    this._loginService.externalLoginCallback(params);
                } else {
                    this._loginService.externalBindingCallback(params);
                }
            } else {
                this._loginService.init((externalLoginProviders) => {
                    for (let i = 0; i < externalLoginProviders.length; i++) {
                        if (externalLoginProviders[i].name === 'WeChatMP') {
                            const authBaseUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize';
                            const appid = externalLoginProviders[i].clientId;
                            const redirect_url = AppConsts.appBaseUrl + '/auth/external' + '?providerName=' + ExternalLoginProvider.WECHATMP + '&isAuthBind=' + this.isAuthBind;
                            const response_type = 'code';
                            const scope = 'snsapi_userinfo';

                            const authUrl = `${authBaseUrl}?appid=${appid}&redirect_uri=${encodeURIComponent(redirect_url)}&response_type=${response_type}&scope=${scope}#wechat_redirect`;
                            window.location.href = authUrl;
                        }
                    }
                });
            }
        });
    }
}
