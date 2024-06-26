import { Injectable } from '@angular/core';

import firebase from 'firebase/app';
import { AngularFireAuth } from '@angular/fire/auth';
import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { switchMap, first, map } from 'rxjs/operators';
import { SignalService } from '../signal/signal.service';
import { User } from './models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  //user firestore reference
  user$: Observable<User>;

  //informs if prekey bundle needs to be stored to indexedDb or read from indexedDb
  isSignedIn = false;

  constructor(
    private angularFireAuth: AngularFireAuth,
    private angularFirestore: AngularFirestore,
    private router: Router,
    private SignalService: SignalService
  ) {
    console.log('authservice works');
    //listening to the angularfire authState (currently authenticated user) and grabbing related user document with their profail information
    this.user$ = this.angularFireAuth.authState.pipe(
      switchMap((user: User) => {
        if (user) {
          return this.angularFirestore
            .doc<any>(`users/${user.email}`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );
  }

  getUser() {
    //converts user observable to a promise so we can later use it with async await
    if (this.user$)
      return this.user$.pipe(first()).toPromise();
    else {
      console.log('getUser() failed');
    }
  }

  signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return this.onSignInWithGoogleGoogle(provider);
  }

  async onSignInWithGoogleGoogle(provider: firebase.auth.AuthProvider) {
    const credential = await this.angularFireAuth.signInWithPopup(provider);
    return this.updateUserData(credential.user);
  }

  async googleSignOut() {
    await this.angularFireAuth.signOut();
    this.router.navigate(['/']);
  }

  async createAccountEmailPassword(
    email: string,
    password: string,
    userName: string
  ) {
    return this.angularFireAuth
      .createUserWithEmailAndPassword(email, password)
      .then((result) => {
        console.log(result.user);
        //call updateProfile to add userName in "data" object
        this.updateProfile(result.user, userName);
        this.router.navigate(['/signin']);
      })
      .catch((error) => {
        alert(error.message);
      });
  }

  signInEmailPassword(email: string, password: string) {
    return this.angularFireAuth
      .signInWithEmailAndPassword(email, password)
      .then(() => {
        console.log('signed in');
        this.router.navigate(['/user-homepage']);
      }).catch(error =>   alert(error.message));
  }

  updateProfile(user: User, displayName: string) {
    const data = {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: user.photoURL,
    };
    this.updateUserData(data);
  }

  private async updateUserData(user: User) {
    const userRef: AngularFirestoreDocument<any> = this.angularFirestore.doc(
      `users/${user.email}`
    );
    this.angularFirestore
      .collection('users')
      .doc(`${user.email}`)
      .get()
      .subscribe(async (doc) => {
        if (doc.exists) {
          const data = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };
          await userRef.set(data, { merge: true });
          this.router.navigate(['/user-homepage']);
        } else {
          this.isSignedIn = true;
          const preKeyBundle = await this.SignalService.createId();
          console.log(preKeyBundle);
          const data = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            preKeyBundle,
          };

          await userRef.set(data, { merge: true });
          this.router.navigate(['/user-homepage']);
        }
      });
  }
}
