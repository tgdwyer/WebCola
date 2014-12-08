
##Introduction

Connecting apps to other apps 

This document discusses four different strategies for integrating apps with other apps and building app 'ecosystems':
 1. 'Piecemeal Integration',
 2. 'Central Hub',
 3. 'Intergration as a Service', and
 4. 'Open Vocab'

We argue that 'Open Vocab' Strategy promotes more democratic and scalable app 'ecosystems', compared to the other options.

Next we discuss how app developers can progresively implement the Open Vocab strategy. 

Finally, we make specific API reccomendations for app's that wish to integrate using Loomio, Cobudget and DemcracyOS as examples.  


##Strategies for App Ecosystems

###Piecemeal Integration

The main problem for any integration strategy is that developers inevitably represent the same or similar data in their apps in different ways. These representations are known as 'models'. Apps that follow a piecemeal integration strategy connect the data of one app provider to another *one at a time*, through specific *translation layers* that transform models in one app into models in another. 

For example, user account in Loomio is stored in a model known as a 'User', but in DemocracyOS the same concept is known as a ['Citizen'](https://github.com/DemocracyOS/app/blob/development/lib/models/citizen.js). Further, these models have similar properties but are specified with slightly different terminology. In DemocracyOS a 'Citizen' includes the following properties:

```Citizen:
	firstName:
	lastName:
	username:
	avatar:
	createdAt:
	updatedAt:
	profilePictureUrl:
	disabledAt:
	... 
```

While in Loomio a 'User' includes the following:

```User:
	name:
	username:
	avatar_initials:
	avatar_kind:
	avatar_url:
	profile_url:
	... 

```

Both of these include the term 'username' which is undoubtedly the same concept, but other properties use different terms e.g. ```profile_url``` is the same concept as ```profilePictureUrl``` while the 'name' concept is specified as ```name``` in Loomio but split accross ```firstName``` and ```lastName``` in DemocracyOS. If these apps followed a Piecemeal Integration strategy and wished to allow users to share their personal data accross apps, i.e. an 'Import your account details from Loomio/DemocracyOS' the developers would have to write a specific 'translation layer' for transforming one of these models into another, *in addition* to the 'Import account' feature. 

###Central Hub

The central

###Integration as a Service

###Open Vocab


## Linked Data and Open Vocab Implemention Strategies


##User

##Group

##Membership

##Motion 

##Vote